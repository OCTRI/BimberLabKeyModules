Ext4.define('TCRdb.panel.cDNAImportPanel', {
    extend: 'TCRdb.panel.PoolImportPanel',

    IGNORED_COLUMNS: ['animalId', 'sampleDate', 'stimId', 'population', 'sortId', 'hto', 'cells', 'stim', 'effector', 'stim_num'],

    initComponent: function () {
        this.COLUMN_MAP = {};
        Ext4.Array.forEach(this.COLUMNS, function (col) {
            if (this.IGNORED_COLUMNS.indexOf(col.name) > -1) {
                return;
            }

            this.COLUMN_MAP[col.name.toLowerCase()] = col;
            Ext4.Array.forEach(col.labels, function (alias) {
                this.COLUMN_MAP[alias.toLowerCase()] = col;
            }, this);
        }, this);

        Ext4.apply(this, {
            title: null,
            border: false,
            defaults: {
                border: false
            },
            items: this.getPanelItems()
        });

        this.callParent(arguments);
    },

    getPanelItems: function(){
        return [{
            layout: {
                type: 'hbox'
            },
            items: [{
                xtype: 'ldk-integerfield',
                style: 'margin-right: 5px;',
                fieldLabel: 'Current Folder/Workbook',
                labelWidth: 200,
                minValue: 1,
                value: LABKEY.Security.currentContainer.type === 'workbook' ? LABKEY.Security.currentContainer.name : null,
                emptyText: LABKEY.Security.currentContainer.type === 'workbook' ? null : 'Showing All',
                listeners: {
                    afterRender: function (field) {
                        new Ext4.util.KeyNav(field.getEl(), {
                            enter: function (e) {
                                var btn = field.up('panel').down('#goButton');
                                btn.handler(btn);
                            },
                            scope: this
                        });
                    }
                }
            }, {
                xtype: 'button',
                itemId: 'goButton',
                scope: this,
                text: 'Go',
                handler: function (btn) {
                    var wb = btn.up('panel').down('ldk-integerfield').getValue();
                    if (!wb) {
                        wb = '';
                    }

                    var container = LABKEY.Security.currentContainer.type === 'workbook' ? LABKEY.Security.currentContainer.parentPath + '/' + wb : LABKEY.Security.currentContainer.path + '/' + wb;
                    window.location = LABKEY.ActionURL.buildURL('tcrdb', 'poolImport', container);
                }
            }, {
                xtype: 'button',
                scope: this,
                hidden: !LABKEY.Security.currentUser.canInsert,
                text: 'Create Workbook',
                handler: function (btn) {
                    Ext4.create('Laboratory.window.WorkbookCreationWindow', {
                        abortIfContainerIsWorkbook: false,
                        canAddToExistingExperiment: false,
                        controller: 'tcrdb',
                        action: 'poolImport',
                        title: 'Create Workbook'
                    }).show();
                }
            }]
        }, {
            style: 'padding-top: 10px;',
            html: 'This page is designed to help import the readset/index information for 10x libraries, after the stim/sort data has already been imported.<p>'
        }, {
            layout: 'hbox',
            items: [{
                xtype: 'button',
                text: 'Download Template',
                border: true,
                scope: this,
                href: LABKEY.ActionURL.getContextPath() + '/tcrdb/exampleData/ImportReadsetTemplate.xlsx'
            }]
        }, {
            xtype: 'textfield',
            style: 'margin-top: 20px;',
            fieldLabel: 'Expt Number',
            itemId: 'exptNum',
            value: LABKEY.Security.currentContainer.type === 'workbook' ? LABKEY.Security.currentContainer.name : null
        }, {
            xtype: 'checkbox',
            fieldLabel: 'Require GEX Library',
            itemId: 'requireGEX',
            checked: true
        }, {
            xtype: 'checkbox',
            fieldLabel: 'Require TCR Library',
            itemId: 'requireTCR',
            checked: true
        }, {
            xtype: 'checkbox',
            fieldLabel: 'Require HTO Library',
            itemId: 'requireHTO',
            checked: true
        }, {
            xtype: 'checkbox',
            fieldLabel: 'Require Library Concentrations',
            itemId: 'requireConc',
            checked: true
        },{
            xtype: 'ldk-simplecombo',
            fieldLabel: '10x Barcode Series',
            itemId: 'barcodeSeries',
            forceSelection: true,
            storeValues: ['SI-GA'],
            value: 'SI-GA'
        }, {
            xtype: 'textarea',
            fieldLabel: 'Paste Data Below',
            labelAlign: 'top',
            itemId: 'data',
            width: 1000,
            height: 300
        }, {
            xtype: 'button',
            text: 'Preview',
            border: true,
            scope: this,
            handler: this.onPreview
        }, {
            style: 'margin-top: 20px;margin-bottom: 10px;',
            itemId: 'previewArea',
            autoEl: 'table',
            cls: 'stripe hover'
        }];
    },

    onPreview: function (btn) {
        var text = this.down('#data').getValue();
        if (!text) {
            Ext4.Msg.alert('Error', 'Must provide the table of data');
            return;
        }

        this.EXPERIMENT = this.down('#exptNum').getValue();

        text = Ext4.String.trim(text);

        var rows = LDK.Utils.CSVToArray(text, '\t');
        var colArray = this.parseHeader(rows.shift());
        var parsedRows = this.parseRows(colArray, rows);

        var groupedRows = this.groupForImport(colArray, parsedRows);
        if (!groupedRows) {
            console.log('No rows after grouping');
            return;
        }

        var workbooks = [];
        var hadError = false;
        Ext4.Array.forEach(parsedRows, function(row){
            if (!row.workbook) {
                hadError = true;
            }
            else {
                workbooks.push(row.workbook);
            }
        }, this);

        if (hadError) {
            Ext4.Msg.alert('Error', 'One or more rows missing a workbook ID');
            return;
        }

        Ext4.Msg.wait('Loading workbooks');
        LABKEY.Query.selectRows({
            containerPath: Laboratory.Utils.getQueryContainerPath(),
            schemaName: 'core',
            queryName: 'workbooks',
            columns: 'workbookId,EntityId',
            filterArray: [LABKEY.Filter.create('plateId', Ext4.unique(workbooks).join(';'), LABKEY.Filter.Types.IN)],
            scope: this,
            success: function(results) {
                Ext4.Msg.hide();

                var workbookMap = {};
                Ext4.Array.forEach(results.rows, function(r){
                    workbookMap[r.workbookId] = r.EntityId;
                }, this);

                Ext4.Array.forEach(groupedRows.cDNARows, function(r){
                    LDK.Assert.assertNotEmpty('Unable to find workbook in map: ' + r.workbook, workbookMap[r.workbook]);
                    r.container = workbookMap[r.workbook];
                }, this);

                Ext4.Array.forEach(groupedRows.readsetRows, function(r){
                    LDK.Assert.assertNotEmpty('Unable to find workbook in map: ' + r.workbook, workbookMap[r.workbook]);
                    r.container = workbookMap[r.workbook];
                }, this);

                this.onWorkbookQueryLoad(colArray, parsedRows, groupedRows);
            },
            failure: LDK.Utils.getErrorCallback()
        });
    },

    onWorkbookQueryLoad: function(colArray, parsedRows, groupedRows) {
        var plateIDs = [];
        var hadError = false;
        Ext4.Array.forEach(parsedRows, function(row){
            if (!row.plateId) {
                hadError = true;
            }
            else {
                plateIDs.push(row.plateId);
            }
        }, this);

        if (hadError) {
            Ext4.Msg.alert('Error', 'One or more rows missing plate ID');
            return;
        }

        plateIDs = Ext4.unique(plateIDs);

        Ext4.Msg.wait('Looking for matching cDNA');
        LABKEY.Query.selectRows({
            containerPath: Laboratory.Utils.getQueryContainerPath(),
            schemaName: 'tcrdb',
            queryName: 'cdnas',
            columns: 'rowid,plateid,readsetid,enrichedreadsetid,hashingreadsetid,sortid/population,sortid,sortid/stimid',
            filterArray: [LABKEY.Filter.create('plateId', plateIDs.join(';'), LABKEY.Filter.Types.IN)],
            scope: this,
            success: function(results) {
                Ext4.Msg.hide();

                if (!results.rows || !results.rows.length) {
                    Ext4.Msg.alert('Error', 'No matching rows found');
                    return;
                }

                var plateToCDNAMap = {};
                Ext4.Array.forEach(results.rows, function(row) {
                    plateToCDNAMap[row.plateId] = plateToCDNAMap[row.plateId] || [];
                    plateToCDNAMap[row.plateId].push(row.rowid);
                }, this);

                var missing = [];
                Ext4.Array.forEach(plateIDs, function (r) {
                    if (!plateToCDNAMap[r]) {
                        missing.push(r);
                    }
                }, this);

                if (missing.length) {
                    Ext4.Msg.alert('Error', 'No cDNA records found for plates: ' + missing.join(', '));
                    return;
                }

                Ext4.Array.forEach(groupedRows.cDNARows, function(r){
                    r.rowIds = plateToCDNAMap[r.plateId];
                }, this);

                this.renderPreview(colArray, parsedRows, groupedRows);
            },
            failure: LDK.Utils.getErrorCallback()
        });
    },

    onSubmit: function (e, dt, node, config) {
        Ext4.Msg.wait('Saving...');

        var data = config.rowData.groupedRows;

        LABKEY.Query.insertRows({
            containerPath: Laboratory.Utils.getQueryContainerPath(),
            schemaName: 'sequenceanalysis',
            queryName: 'sequence_readsets',
            rows: data.readsetRows,
            success: function(results){
                var readsetMap = {};
                Ext4.Array.forEach(results.rows, function(row){
                    readsetMap[row.name] = row.rowId;
                }, this);

                var toUpdate = [];
                Ext4.Array.forEach(data.cDNARows, function(row){
                    var baseRow = {};

                    var gexReadsetId = readsetMap[row.plateId + '-GEX'];
                    if (gexReadsetId) {
                        baseRow.readsetId = gexReadsetId;
                    }

                    var tcrReadsetId = readsetMap[row.plateId + '-TCR'];
                    if (tcrReadsetId) {
                        baseRow.enrichedReadsetId = tcrReadsetId;
                    }

                    var htoReadsetId = readsetMap[row.plateId + '-HTO'];
                    if (htoReadsetId) {
                        baseRow.hashingReadsetId = htoReadsetId;
                    }

                    baseRow.container = row.container;

                    if (row.rowIds) {
                        Ext4.Array.forEach(row.rowIds, function(r){
                            var toAdd = Ext4.apply({
                                rowId: r
                            }, baseRow);

                            toUpdate.push(toAdd);
                        }, this);
                    }
                }, this);

                if (toUpdate.length) {
                    LABKEY.Query.updateRows({
                        containerPath: Laboratory.Utils.getQueryContainerPath(),
                        schemaName: 'tcrdb',
                        queryName: 'cdnas',
                        rows: toUpdate,
                        success: function (results) {
                            Ext4.Msg.hide();
                            Ext4.Msg.alert('Success', 'Data Saved', function(){
                                window.location = LABKEY.ActionURL.buildURL('query', 'executeQuery.view', Laboratory.Utils.getQueryContainerPath(), {'query.queryName': 'cdnas', schemaName: 'tcrdb', 'query.sort': '-created'});
                            }, this);
                        },
                        failure: LDK.Utils.getErrorCallback(),
                        scope: this
                    });
                }
            },
            failure: LDK.Utils.getErrorCallback(),
            scope: this
        });
    }
});