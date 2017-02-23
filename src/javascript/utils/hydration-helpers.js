/******************************************************************************
 *
 * A series of methods that are hardcoded to account for nuances of hydration
 * based on what is available in the Rally lookback API
 *
 *******************************************************************************/


Ext.define('CA.agile.technicalservices.HydrationHelper',{

    singleton: true ,

    /**
     * getBucketFieldModelType
     * @returns {*}
     *
     * If we allow for any other fields that need to be manually hydrated, then
     * we need to modify this.  I can't think of any other fields that we'd need to do this
     * with at this point (Milestones, Tags and possibly multi-select fields are ones that
     * would fall into the category of needing manual hydration
     */

    getFieldModelType: function(field){
        if (Ext.Array.contains([
                'Owner',
                'SubmittedBy',
                'Tester'
            ], field)){

            return "User";
        }
        return null;
    },
    getFieldFetchList: function(field){
        var type = CA.agile.technicalservices.HydrationHelper.getFieldModelType(field);
        if (type === 'User'){
            return ['ObjectID','UserName','DisplayName','FirstName','LastName'];
        }
        return ['ObjectID'];
    },
    needsManualHydration: function(field){
        return Ext.Array.contains([
            'Owner',
            'SubmittedBy'
        ], field);
    },
    /**
     * getHydrateConfig
     * @returns {*}
     *
     * This returns a hydrate clause for the lookback fetch.  Currently these fields can be
     * hydrated automatically if this is sent into the lookback config.  IF the lookback API
     * changes to allow for additional fields to be hydrated (unlikely), we should modify this.
     */
    getHydrateConfig: function(field){
        if (Ext.Array.contains([
                'Project',
                'State',
                'ScheduleState',
                'Iteration',
                'Release',
                'Priority',
                'Severity',
                'Environment'
            ],field)){

            return [field];
        }
        return undefined;
    },
    getActualBucketFieldProperty: function(field){
        if (Ext.Array.contains([
                'Owner',
                'SubmittedBy',
                'Tester'
            ], field)){
            return field + ".DisplayName";
        }

        if (field === 'Project'){
            return "Project.Name";
        }
        return field;
    },
    /**
     * END of hydration helpers
     */
});