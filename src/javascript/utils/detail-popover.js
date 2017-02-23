
    Ext.define('CA.agile.technicalservices.DetailPopover', {
        alias: 'widget.artifactdetailpopover',
        extend: 'Rally.ui.popover.Popover',
        requires: ['Rally.ui.grid.TreeGrid'],

        id: 'treegrid-popover',
        cls: 'treegrid-popover',

        width: 750,
        maxHeight: 600,

        layout: 'fit',


        initComponent: function() {
            this.callParent(arguments);

            this._buildGridStore().then({
                success: function(store) {
                    this.add(this._getGridConfig(store));
                },
                scope: this
            });
        },

        _buildGridStore: function() {
            var dataContext = this.getContext(),
                storeConfig = Ext.apply({
                    pageSize: 10,
                    context: dataContext,
                    autoLoad: true,
                    models: this.modelNames,
                    remoteSort: true,
                    enableHierarchy: false
                }, this.gridConfig.storeConfig);

            delete this.gridConfig.storeConfig;

            return Ext.create('Rally.data.wsapi.TreeStoreBuilder').build(storeConfig);
        },

        _getGridConfig: function(store) {
            return Ext.apply({
                xtype: 'rallytreegrid',
                itemId: 'treegrid',
                pagingToolbarCfg: {
                    margin: '10 0 0 0',
                    height: 22,
                    pageSizes: []
                },
                store: store
            }, this.gridConfig);
        }
    });
