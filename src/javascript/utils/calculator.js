Ext.define('CA.agile.technicalservices.HistoryMatrixCalculator', {
    extend: 'Rally.data.lookback.calculator.TimeSeriesCalculator',

    noneText: "-- None --",

    getMetrics: function () {
        var fields = [];

        /**
         * for each bucket of the bucket field, create a metric that is the count of the items in that field
         * for the date
         */
        for (var i=0; i<this.buckets.length; i++){
            var bucket = this.buckets[i];
            fields.push({
                field: this.bucketField,
                as: bucket.toString(),
                "f": "filteredCount",
                "filterField": this.bucketField,
                "filterValues": [bucket],
                "display": "column"
            });
        }
        return fields;
    },
    prepareChartData: function (store) {
        var snapshots = [],
            buckets = [];
        /**
         * Grab the different buckets here so that we can
         * create metrics based on this
         */
        store.each(function (record) {
            var data = record.getData();
            var bucketValue = data[this.bucketField] || this.noneText;
            if (Ext.isObject(bucketValue)){
                console.log('bucketValue', bucketValue);
                bucketValue = bucketValue._refObjectName || bucketValue.Name;
            }
            if (!Ext.Array.contains(buckets, bucketValue)){
                buckets.push(bucketValue);
            }
            data[this.bucketField] = bucketValue;
            snapshots.push(data);

        }, this);
        this.buckets = buckets;

        return this.runCalculation(snapshots);
    }
});