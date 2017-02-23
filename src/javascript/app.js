Ext.define("artifact-history-matrix", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'selector_box',layout: 'vbox', html: '<div class="rally-title">Filter By</div>'},
        {xtype:'container',itemId:'display_box'}
    ],

    integrationHeaders : {
        name : "artifact-history-matrix"
    },

    noneText: "-- None --",

    /**
     * User can pick any dropdown field (custom and builtin) that do not
     * need to be hydrated.
     *
     * Additional fields that can be used as bucket fields will be noted in the
     * bucketFieldWhitelist below
     */
    bucketFieldWhitelist: [
        'Project',
        'Owner',
        'SubmittedBy',
        'ScheduleState',
        'State',
        'Priority',
        'Severity',
        'Environment'
    ],
    bucketFieldAttributeTypeWhitelist: [
        'STRING'
    ],
    detailFetchFields: ["FormattedID","Name","State"],
    config: {
        defaultSettings: {
            artifactType: 'Defect',
            historicalDays: 4,
            bucketField: 'SubmittedBy'
        }
    },
    launch: function() {
        Rally.dependencies.Analytics.load(function() {
            // this._loadChart must be called asynchronously in both rui and app sdk
            // in order for client metrics event parenting to happen correctly
            Ext.Function.defer(this.addSelectors, 1, this);
        }, this);
    },
    updateView: function(){
        var milestones = this.down('rallymilestonepicker').getValue(),
            tags = this.down('rallytagpicker').getValue(),
            states = this.down('rallyfieldvaluecombobox').getValue();

        this.logger.log('updateView',states, milestones, tags || 'no tags');

        this.getDisplayBox().removeAll();
        this.fetchData(milestones, tags, states);
    },
    addSelectors: function(){
        this.getSelectorBox().removeAll();

        var box1 = this.getSelectorBox().add({
            xtype: 'container',
            layout: 'hbox'
        });

        var sb = box1.add({
            xtype: 'rallyfieldvaluecombobox',
            itemId: 'statePicker',
            margin: '25 5 5 5',
            fieldLabel: 'State',
            labelWidth: 50,
            model: this.getArtifactType(),
            field: "State",
            multiSelect: true,
            labelAlign: 'right',
            stateful: true,
            stateId: 'state-picker',
            width: 250
        });
        sb.on('select', this.updateView, this);

        var pb = box1.add({
            xtype: 'rallyfieldvaluecombobox',
            itemId: 'priorityPicker',
            margin: '25 5 5 5',
            fieldLabel: 'Priority',
            labelWidth: 50,
            model: this.getArtifactType(),
            field: "Priority",
            multiSelect: true,
            labelAlign: 'right',
            stateful: true,
            stateId: 'priority-picker',
            width: 250
        });
        pb.on('select', this.updateView, this);

        var box2 = this.getSelectorBox().add({
            xtype: 'container',
            layout: 'hbox'
        });

        var mb = box2.add({
            xtype: 'rallymilestonepicker',
            storeConfig: {
                context: {project: null}
            },
            labelWidth: 50,
            margin: 5,
            fieldLabel: 'Milestone',
            labelAlign: 'right',
            labelSeparator: '',
            width: 250
        });
        mb.on('selectionchange', this.updateView, this);

        var tb = box2.add({
            xtype: 'rallytagpicker',
            margin: 5,
            fieldLabel: 'Tag',
            labelAlign: 'right',
            labelWidth: 50,
            labelSeparator: '',
            width: 250
        });
        tb.on('selectionchange', this.updateView, this);
        this.updateView();
    },
    showErrorNotification: function(msg){
        Rally.ui.notify.Notifier.showError({message: msg});
    },
    processData: function(store){
        this.setLoading(false);
        var calc = Ext.create('CA.agile.technicalservices.HistoryMatrixCalculator',{
            startDate: Rally.util.DateTime.fromIsoString(this.getIsoStartDate()),
            endDate: new Date(),
            bucketField: this.getBucketField(),
            noneText: this.noneText
        });
        var data = calc.prepareChartData(store);

        this.logger.log('processData', data);

        if (CA.agile.technicalservices.HydrationHelper.needsManualHydration(this.getBucketField())){
            this.setLoading("Hydrating...");
            this.fetchMetaData(calc.buckets).then({
                success: function(bucketValueMap){
                    this.buildGrid(data, bucketValueMap);
                },
                failure: function(msg){
                    this.showErrorNotification(msg);
                    this.buildGrid(data);
                },
                scope: this
            }).always(function(){ this.setLoading(false);}, this);
        } else {
           this.buildGrid(data);
        }
   },
    buildGrid: function(data, bucketValueMap){

        var bucketField = this.getBucketField(),
            fields = [bucketField].concat(data.categories);

        this.logger.log('buildGrid', data, fields, bucketField);
        var storeData = [];
        for (var j = 0; j < data.series.length; j++){
            var s = data.series[j];
            var row = {};
            row[bucketField] = s.name;
            if (bucketValueMap && (bucketValueMap[s.name] || bucketValueMap[s.name.toString()])){
                row[bucketField] = (bucketValueMap[s.name] || bucketValueMap[s.name.toString()]);
            }

            for (var i = 0; i < data.categories.length; i++){
                row[data.categories[i]] = s.data[i];
            }
            storeData.push(row);
        };

        this.logger.log('buildGrid storeData', storeData);
        var store = Ext.create('Rally.data.custom.Store',{
            fields: fields,
            data: storeData,
            pageSize: storeData.length
        });

        this.getDisplayBox().removeAll();
        var grid = this.getDisplayBox().add({
            xtype: 'rallygrid',
            store: store,
            columnCfgs: this.getColumnCfgs(data.categories),
            showRowActionsColumn: false,
            showPagingToolbar: false
        });
        grid.on('itemdblclick', this.showCurrentArtifacts, this);
    },
    showCurrentArtifacts: function(grid, record){
        var milestones = this.down('rallymilestonepicker').getValue(),
            tags = this.down('rallytagpicker').getValue(),
            states = this.down('#statePicker').getValue(),
            priorities = this.down('#priorityPicker').getValue();

        this.logger.log('showCurrentArtifacts', record, milestones, tags, states, priorities);

        var bucketFieldValue = record.get(this.getBucketField());
        //deal with blank values in the bucket field
        bucketFieldValue = bucketFieldValue.replace(this.noneText, '');

        //We need to get the right property to query with
        var bucketFieldProperty = CA.agile.technicalservices.HydrationHelper.getActualBucketFieldProperty(this.getBucketField());
        if (bucketFieldValue === ''){
            bucketFieldProperty = this.getBucketField();
        }

        var filters = Ext.create('Rally.data.wsapi.Filter',{
            property: bucketFieldProperty,
            value: bucketFieldValue
        });

        if (states && states.length > 0){
            var tempFilters = this.getTempFilters('State',states);
            filters = filters.and(tempFilters);
        }
        this.logger.log('showCurrentArtifacts filters with states', filters.toString());

        if (priorities && priorities.length > 0){
            var tempFilters = this.getTempFilters('Priority',priorities);
            filters = filters.and(tempFilters);
        }
        this.logger.log('showCurrentArtifacts filters with priorities', filters.toString());

        if (milestones && milestones.length > 0){
            var tempFilters = this.getTempFilters('Milestones.ObjectID',milestones);
            filters = filters.and(tempFilters);
        }
        this.logger.log('showCurrentArtifacts filters with milestones', filters.toString());

        if (tags && tags.length > 0){
            var tempFilters = this.getTempFilters('Tags.ObjectID',tags);
            filters = filters.and(tempFilters);
        }
        this.logger.log('showCurrentArtifacts filters with tags', filters.toString());

        Ext.create('CA.agile.technicalservices.DetailPopover',{
            context: this.getContext(),
            autoShow: true,
            title: "Defects for " + this.getBucketField() + " [" + record.get(this.getBucketField()) + "]",
            titleIconHtml: '<div class="icon-defect"></div>',
            modelNames: [this.getArtifactType()],
            target: grid.getEl(),
            gridConfig: {
                storeConfig: {
                    filters: filters,
                    fetch: this.detailFetchFields,
                    context: {project: null}
                },
                columnCfgs: this.detailFetchFields
            }
        });

    },
    getTempFilters: function(field, values){
        var tempFilters = Ext.Array.map(values, function(v){
            if (v === "None"){ v = ""; }
            return {
                property: field,
                value: v
            };
        });
        if (tempFilters.length > 1){
            tempFilters = Rally.data.wsapi.Filter.or(tempFilters);
        } else {
            return Ext.create('Rally.data.wsapi.Filter', tempFilters[0]);
        }
        return tempFilters;
    },
    getColumnCfgs: function(buckets){
        var cols = [{
            dataIndex: this.getBucketField(),
            text: this.getBucketField(),
            flex: 1
        }];

        Ext.Array.each(buckets, function(b){
            cols.push({
                dataIndex: b,
                text: b
            });
        });
        return cols;
    },
    /**
     * fetchMetaData
     * @param store
     *
     * if the bucket field needs to be manually hydrated, then we will do that here.
     * Otherwise, we'll just call ProcessData directly
     */
    fetchMetaData: function(buckets){
        var deferred = Ext.create('Deft.Deferred');
        this.logger.log('fetchMetaData', buckets);
        var filters = [];
        Ext.Array.each(buckets, function(b){
            if (!isNaN(b)){
                filters.push({
                    property: 'ObjectID',
                    value: b
                });
            }
        });

        if(filters.length > 1){
            filters = Rally.data.wsapi.Filter.or(filters);
        }
        this.logger.log('filters', filters, filters.toString());

        Ext.create('Rally.data.wsapi.Store',{
            model: CA.agile.technicalservices.HydrationHelper.getFieldModelType(this.getBucketField()),
            fetch: CA.agile.technicalservices.HydrationHelper.getFieldFetchList(this.getBucketField()),
            filters: filters,
            enablePostGet: true,
            limit: buckets.length,
            context: {project: null},
            pageSize: Math.min(2000, buckets.length)
        }).load({
            callback: function(records, operation){
                if (operation.wasSuccessful()){
                    var map = _.reduce(records, function(obj, rec){
                        obj[rec.get('ObjectID')] = rec.get('_refObjectName');
                        return obj;
                    }, {});

                    deferred.resolve(map);
                } else {
                    deferred.reject('Error loading meta data.  Object IDs will be displayed instead:  ' + operation.error.errors.join(','));
                }
            }
        });
        return deferred.promise;
    },
    getObjectIDList: function(records){
        return Ext.Array.map(records, function(r){
            return r.get('ObjectID');
        });
    },
    fetchData: function(milestones, tags, states){

        var config = {
            _TypeHierarchy: this.getArtifactType(),
            _ValidTo: {$gte: this.getIsoStartDate()}
        };

        if (milestones && milestones.length > 0){
            config.Milestones = {$in: this.getObjectIDList(milestones) };
        }

        if (tags && tags.length > 0){
            config.Tags = {$in: this.getObjectIDList(tags) }
        }

        if (states && states.length > 0){
            config.State = {$in: states};
        }

        this.logger.log('fetchData', config, this.getBucketField());

        this.setLoading(true);
        var store = Ext.create('Rally.data.lookback.SnapshotStore',{
            findConfig: config,
            fetch: [this.getBucketField(), '_ValidFrom','_ValidTo'],
            limit: Infinity,
            removeUnauthorizedSnapshots: true,
            hydrate: CA.agile.technicalservices.HydrationHelper.getHydrateConfig(this.getBucketField())
        });

        store.on('load', this.processData, this);
        store.load();
    },
    getIsoStartDate: function(){
        var currentDate = new Date();
        currentDate.setHours(0);
        currentDate.setMinutes(0);
        currentDate.setSeconds(0);
        var date = Rally.util.DateTime.add(currentDate, 'day', this.getDaysBack() - 1);
        return Rally.util.DateTime.toIsoString(date);
    },
    getDaysBack: function(){
        var setting = this.getSetting('historicalDays') || 5;
        return -setting;
    },
    getBucketField: function(){
        return this.getSetting('bucketField') || 'Project';
    },
    getArtifactType: function(){
        return this.getSetting('artifactType') || 'Defect';
    },
    getDisplayBox: function(){
        return this.down('#display_box');
    },
    getSelectorBox: function(){
        return this.down('#selector_box');
    },

    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    getSettingsFields: function(attributeTypeWhitelist, fieldWhitelist){
        var attributeTypeWhitelist = this.bucketFieldAttributeTypeWhitelist,
            fieldWhitelist = this.bucketFieldWhitelist;

        var labelWidth = 100;
        return [{
            xtype: 'rallynumberfield',
            name: 'historicalDays',
            minValue: 0,
            maxValue: 25,
            fieldLabel: '# Historical Days',
            labelAlign: 'right',
            labelWidth: labelWidth
        },{
            xtype: 'rallyfieldcombobox',
            name: 'bucketField',
            model: this.getArtifactType(),
            fieldLabel: 'Bucket Field',
            labelAlign: 'right',
            labelWidth: labelWidth,
            _isNotHidden: function(field) {
                if (!field.readOnly && !field.hidden && field.attributeDefinition){
                    var show = Ext.Array.contains(fieldWhitelist, field.name);
                    if (!show){
                        show = Ext.Array.contains(attributeTypeWhitelist, field.attributeDefinition.AttributeType);
                    }
                    return show;
                }
                return false;
            }

        }];
    }
    
});
