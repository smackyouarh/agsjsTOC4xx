//---------------------------------------IMPORTANT PLEASE READ-------------------------------------------------
// ONLY USE THIS FOR ARCGIS JAPI 4.xx AND ABOVE. THIS WIDGET WILL NOT WORK WITH ANY VERSION BELOW.
// Current Only Supports MapImageLayer,TileLayer and FeatureLayer
// If you are using NodeJS and esriLoader please download use TOC_esriLoader.js instead
//                                       
// CREDITS TO Nianwei Liu for original widget @ https://www.arcgis.com/home/item.html?id=9b6280a6bfb0430f8d1ebc969276b109
/**
 * @name Table of Contents (TOC) widget for ArcGIS Server JavaScript API by Nianwei Liu modified For Arcgis JSAPI Version 4.xx 
 * @author: Ang Hiap Lee
 * @fileoverview
 * <p>A TOC (Table of Contents) widget for ESRI ArcGIS Server JavaScript API 4.xx. The namespace is <code>agsjs</code></p>
 */
// change log: 
// v0.3 -- 2017-11-28: Fixed layers being displayed in reversed order - Credits to Matt Price for finding solution
// v0.2 -- 2017-11-04: Fixed typo errors causing widget to not work with some map services
// v0.1 -- 2017-11-03: Modified library to be compatible with Arcgis JSAPI 4.xx 


define("agsjs/dijit/TOC", [
    "esri/layers/MapImageLayer", "esri/layers/TileLayer", "esri/layers/FeatureLayer",
    'dijit/form/Form', 'dijit/form/CheckBox', 'dijit/form/HorizontalSlider', 'dojo/dom-attr', 'dojo/dom-style',
    'dojo/dom-class', 'dojo/dom-construct', 'dojo/_base/array', 'dojo/fx',
    'dojo/_base/declare', 'dijit/_Widget', 'dijit/_Templated',
    'dojox/gfx', 'dojo/fx/Toggler', 'dijit/form/Slider'],
    function (
        MapImageLayer, TileLayer, FeatureLayer,
        dijitForm, CheckBox, horizontalSlider, domAttr, domStyle,
        domClass, domContruct, array, coreFx,
        declare, _Widget, _Templated, gfx, Toggler) {

        /**
         * _TOCNode is a node, with 3 possible types: root layer|serviceLayer|legend
         * @private
         */
        var _TOCNode = declare([_Widget, _Templated], {
            templateString: '<div class="agsjsTOCNode">' +
            '<div data-dojo-attach-point="rowNode" data-dojo-attach-event="onclick:_onClick">' +
            '<span data-dojo-attach-point="contentNode" class="agsjsTOCContent">' +
            '<span data-dojo-attach-point="checkContainerNode"></span>' +
            '<img src="${_blankGif}" alt="" data-dojo-attach-point="iconNode" />' +
            '<span data-dojo-attach-point="labelNode">' +
            '</span></span></div>' +
            '<div data-dojo-attach-point="containerNode" style="display: none;"> </div></div>',
            // each node contains reference to rootLayer, servierLayer(layer within service), legend
            // the reason not to use a "type" property is because in the case of legend, it is necessary
            // to access meta data of the serviceLayer and rootLayer as well. 
            rootLayer: null,
            serviceLayer: null,
            legend: null,
            rootLayerTOC: null,
            data: null, // could be one of rootLayer, serviceLayer, or legend
            _childTOCNodes: [],
            constructor: function (params, srcNodeRef) {
                dojo.mixin(this, params);
            },
            // extension point. called automatically after widget DOM ready.
            postCreate: function () {
                domStyle.set(this.rowNode, 'paddingLeft', '' + this.rootLayerTOC.tocWidget.indentSize * this.rootLayerTOC._currentIndent + 'px');
                // using the availability of certain property to decide what kind of node to create.
                // priority is legend/serviceLayer/rootLayer
                this.data = this.legend || this.serviceLayer || this.rootLayer;
                this.blank = this.iconNode.src;
                if (this.legend) {
                    this._createLegendNode(this.legend);
                } else if (this.serviceLayer) {
                    this._createServiceLayerNode(this.serviceLayer);
                } else if (this.rootLayer) {
                    this._createRootLayerNode(this.rootLayer);
                }
                if (this.containerNode && Toggler) {// dojo.fx.
                    // if containerNode was not removed, it means this is some sort of group.
                    this.toggler = new Toggler({
                        node: this.containerNode,
                        showFunc: coreFx.wipeIn,
                        hideFunc: coreFx.wipeOut
                    })
                }
                if (!this._noCheckNode) {
                    // typically _noCheckNode means it is a tiledlayer, or legend item that should not have a checkbox
                    var chk;
                    if (dijitForm && CheckBox) {
                        chk = new CheckBox({ // looks a bug in dijit. image not renderered until mouse over. bug was closed but still exist.
                            // use attr('checked', true) not working either.
                            checked: this.data.visible
                        });
                        chk.placeAt(this.checkContainerNode);
                        chk.startup();
                    } else {
                        chk = domContruct.create('input', {
                            type: 'checkbox',
                            checked: this.data.visible
                        }, this.checkContainerNode);
                    }
                    this.checkNode = chk;
                }
                var showChildren = this.data.visible;
                // if it is a group layer and no child layer is visible, then collapse
                if (this.data.sublayers) {
                    var noneVisible = true;
                    array.every(this.data.sublayers.items, function (info) {
                        if (info.visible) {
                            noneVisible = false;
                            return false;
                        }
                        return true;
                    });
                    if (noneVisible)
                        showChildren = false;
                }
                if (this.data.collapsed)
                    showChildren = false;
                if (this.iconNode && this.iconNode.src == this.blank) {
                    domClass.add(this.iconNode, 'dijitTreeExpando');
                    domClass.add(this.iconNode, showChildren ? 'dijitTreeExpandoOpened' : 'dijitTreeExpandoClosed');
                }
                if (this.iconNode) {
                    domClass.add(this.iconNode, 'agsjsTOCIcon');
                }
                if (this.containerNode) {
                    domStyle.set(this.containerNode, 'display', showChildren ? 'block' : 'none');
                }
                this.domNode.id = 'TOCNode_' + this.rootLayer.id + (this.serviceLayer ? '_' + this.serviceLayer.id : '') + (this.legend ? '_' + this.legend.id : '');
            },
            // root level node, layers directly under esri.Map
            _createRootLayerNode: function (rootLayer) {
                domClass.add(this.rowNode, 'agsjsTOCRootLayer');
                domClass.add(this.labelNode, 'agsjsTOCRootLayerLabel');
                var title = this.rootLayerTOC.config.title;
                // if it is '' then it means we do not title to be shown, i.e. not indent.
                if (title === '') {
                    // we do not want to show the first level, typically in the case of a single map service
                    domStyle.set(this.rowNode, "display", "none")
                    rootLayer.visible = true;
                    this.rootLayerTOC._currentIndent--;
                } else if (title === undefined) {
                    // no title is set, try to find default
                    if (rootLayer.name) {
                        // this is a featureLayer
                        title = rootLayer.name;
                    } else {
                        var start = rootLayer.url.toLowerCase().indexOf('/rest/services/');
                        var end = rootLayer.url.toLowerCase().indexOf('/mapserver', start);
                        title = rootLayer.url.substring(start + 15, end);
                    }
                }
                rootLayer.collapsed = this.rootLayerTOC.config.collapsed;
                if (this.rootLayerTOC.config.slider) {
                    this.sliderNode = domContruct.create('div', {
                        'class': 'agsjsTOCSlider'
                    }, this.rowNode, 'last');//
                    this.slider = new horizontalSlider({
                        showButtons: false,
                        value: rootLayer.opacity * 100,
                        intermediateChanges: true,
                        //style: "width:100%;padding:0 20px 0 20px",
                        tooltip: 'adjust transparency',
                        onChange: function (value) {
                            rootLayer.opacity = value / 100
                        },
                        layoutAlign: 'right'
                    });
                    this.slider.placeAt(this.sliderNode);

                }
                if (!this.rootLayerTOC.config.noLegend) {
                    if (rootLayer._tocInfos) {
                        this._createChildrenNodes(rootLayer._tocInfos, 'serviceLayer');
                    } else if (rootLayer.renderer) {
                        // for feature layers
                        var r = rootLayer.renderer;
                        if (r.infos) {
                            //UniqueValueRenderer |ClassBreaksRenderer
                            var legs = r.infos;
                            if (r.defaultSymbol && legs.length > 0 && legs[0].label != '[all other values]') {
                                // insert at top
                                legs.unshift({
                                    label: '[all other values]',
                                    symbol: r.defaultSymbol
                                })
                            }
                            var af = r.attributeField + (r.normalizationField ? '/' + r.normalizationField : '');
                            af += (r.attributeField2 ? '/' + r.attributeField2 : '') + (r.attributeField3 ? '/' + r.attributeField3 : '');
                            var anode = domContruct.create('div', {}, this.containerNode);
                            domStyle.set(anode, 'paddingLeft', '' + this.rootLayerTOC.tocWidget.indentSize * (this.rootLayerTOC._currentIndent + 2) + 'px');
                            anode.innerHTML = af;
                            this._createChildrenNodes(legs, 'legend');
                        } else {
                            //this._createChildrenNodes([rootLayer.renderer], 'legend');
                            this._setIconNode(rootLayer.renderer, this.iconNode, this);
                            domContruct.destroy(this.containerNode);
                            this.containerNode = null;
                        }

                    } else {
                        domStyle.set(this.iconNode, 'visibility', 'hidden');
                    }
                } else {
                    // no legend means no need for plus/minus sign
                    domStyle.set(this.iconNode, 'visibility', 'hidden');
                }
                this.labelNode.innerHTML = title;
                domAttr.set(this.rowNode, 'title', title);
            },
            // a layer inside a map service.
            _createServiceLayerNode: function (serviceLayer) {
                // layer: layerInfo with nested subLayerInfos
                this.labelNode.innerHTML = serviceLayer.title;
                if (serviceLayer.sublayers) {// group layer
                    domClass.add(this.rowNode, 'agsjsTOCGroupLayer');
                    domClass.add(this.labelNode, 'agsjsTOCGroupLayerLabel');
                    this._createChildrenNodes(serviceLayer.sublayers.items, 'serviceLayer');
                } else {
                    domClass.add(this.rowNode, 'agsjsTOCServiceLayer');
                    domClass.add(this.labelNode, 'agsjsTOCServiceLayerLabel');
                    if (this.rootLayer.tileInfo) {
                        // can not check on/off for tiled
                        this._noCheckNode = true;
                    }
                    if (serviceLayer._legends && !this.rootLayerTOC.config.noLegend) {
                        if (serviceLayer._legends.length == 1) {
                            this.iconNode.src = this._getLegendIconUrl(serviceLayer._legends[0]);
                            domContruct.destroy(this.containerNode);
                            this.containerNode = null;
                        } else {
                            this._createChildrenNodes(serviceLayer._legends, 'legend');
                        }
                    }
                    else if (serviceLayer instanceof FeatureLayer || serviceLayer instanceof TileLayer) {
                        this.iconNode.src = "data:image/png;base64," + serviceLayer._legends["0"].legend["0"].imageData;
                        domContruct.destroy(this.containerNode);
                        this.containerNode = null;
                    }
                    else {
                        domContruct.destroy(this.iconNode);
                        this.iconNode = null;
                        domContruct.destroy(this.containerNode);
                        this.containerNode = null;
                    }
                }
            },
            /*
             a legend data normally have: {description,label,symbol,value}
             */
            _createLegendNode: function (rendLeg) {
                this._noCheckNode = true;
                domContruct.destroy(this.containerNode);
                domClass.add(this.labelNode, 'agsjsTOCLegendLabel');
                this._setIconNode(rendLeg, this.iconNode, this);
                var label = rendLeg.label;
                if (rendLeg.label === undefined) {
                    if (rendLeg.value !== undefined) {
                        label = rendLeg.value;
                    }
                    if (rendLeg.maxValue !== undefined) {
                        label = '' + rendLeg.minValue + ' - ' + rendLeg.maxValue;
                    }
                }
                this.labelNode.appendChild(document.createTextNode(label));
            },
            // set url or replace node
            _setIconNode: function (rendLeg, iconNode, tocNode) {
                var src = this._getLegendIconUrl(rendLeg);
                if (!src) {
                    if (rendLeg.symbol) {
                        var w = this.rootLayerTOC.tocWidget.swatchSize[0];
                        var h = this.rootLayerTOC.tocWidget.swatchSize[1];
                        if (rendLeg.symbol.width && rendLeg.symbol.height) {
                            w = rendLeg.symbol.width;
                            h = rendLeg.symbol.height;
                        }
                        var node = domContruct.create('span', {});
                        domStyle.set(node, {
                            'width': w + 'px',
                            'height': h + 'px',
                            'display': 'inline-block'
                        });
                        domContruct.place(node, iconNode, 'replace');
                        tocNode.iconNode = node;
                        var descriptors = esri.symbol.getShapeDescriptors(rendLeg.symbol);
                        var mySurface = gfx.createSurface(node, w, h);//dojox.
                        if (descriptors) {
                            if (dojo.isIE) {
                                // 2013076: see	http://mail.dojotoolkit.org/pipermail/dojo-interest/2009-December/041404.html
                                window.setTimeout(dojo.hitch(this, '_createSymbol', mySurface, descriptors, w, h), 500);
                            } else {
                                this._createSymbol(mySurface, descriptors, w, h);
                            }
                        }
                    } else {
                        if (console)
                            console.log('no symbol in renderer');
                    }
                } else {
                    iconNode.src = src;
                    if (rendLeg.symbol && rendLeg.symbol.width && rendLeg.symbol.height) {
                        iconNode.style.width = rendLeg.symbol.width;
                        iconNode.style.height = rendLeg.symbol.height;
                    }
                }
            },
            _createSymbol: function (mySurface, descriptors, w, h) {
                var shape = mySurface.createShape(descriptors.defaultShape);
                if (descriptors.fill) {
                    shape.setFill(descriptors.fill);
                }
                if (descriptors.stroke) {
                    shape.setStroke(descriptors.stroke);
                }
                shape.applyTransform({
                    dx: w / 2,
                    dy: h / 2
                });

            },
            _getLegendIconUrl: function (legend) {
                var src = legend.url;
                // in some cases NULL value may cause #legend != #of renderer entry.
                if (src != null && src.indexOf('data') == -1) {
                    if (!dojo.isIE && legend.imageData && legend.imageData.length > 0) {
                        src = "data:image/png;base64," + legend.imageData;
                    } else {
                        if (src.indexOf('http') !== 0) {
                            // resolve relative url
                            src = this.rootLayer.url + '/' + this.serviceLayer.id + '/images/' + src;
                        }
                    }
                }
                return src;
            },
            /**
             * Create children nodes, for serviceLayers, subLayers of a group layer, or legends within a serviceLayer.
             * @param {Object} chdn children nodes data
             * @param {Object} type rootLayer|serviceLayer|legend. It's name will be passed in constructor of _TOCNode.
             */
            _createChildrenNodes: function (chdn, type) {
                this.rootLayerTOC._currentIndent++;
                var c = [];

                for (var i = chdn.length -1, n = -1; i > n; i--) { // Credits to Matt Price for fixing reversed layer order
                    var chd = chdn[i];
                    var params = {
                        rootLayerTOC: this.rootLayerTOC,
                        rootLayer: this.rootLayer,
                        serviceLayer: this.serviceLayer,
                        legend: this.legend,
                        mapView: this.mapView
                    };
                    params[type] = chd;
                    params.data = chd;
                    //var node = new agsjs.dijit._TOCNode(params);
                    if (type == 'legend') {
                        chd.id = 'legend' + i;
                    }
                    var node = new _TOCNode(params);
                    node.placeAt(this.containerNode);
                    c.push(node);
                }
                this._childTOCNodes = c; // for refreshTOC use recursively.
                this.rootLayerTOC._currentIndent--;
            },
            _toggleContainer: function (on) {
                if (domClass.contains(this.iconNode, 'dijitTreeExpandoClosed') ||
                    domClass.contains(this.iconNode, 'dijitTreeExpandoOpened')) {
                    // make sure its not clicked on legend swatch
                    if (on) {
                        domClass.remove(this.iconNode, 'dijitTreeExpandoClosed');
                        domClass.add(this.iconNode, 'dijitTreeExpandoOpened');
                    } else if (on === false) {
                        domClass.remove(this.iconNode, 'dijitTreeExpandoOpened');
                        domClass.add(this.iconNode, 'dijitTreeExpandoClosed');
                    } else {
                        domClass.toggle(this.iconNode, 'dijitTreeExpandoClosed');
                        domClass.toggle(this.iconNode, 'dijitTreeExpandoOpened');
                    }
                    if (domClass.contains(this.iconNode, 'dijitTreeExpandoOpened')) {
                        if (this.toggler) {
                            this.toggler.show();
                        } else {
                            domStyle.set(this.containerNode, "display", "block");

                        }
                    } else {
                        if (this.toggler) {
                            this.toggler.hide();
                        } else {
                            domStyle.set(this.containerNode, "display", "none")
                        }
                    }
                    // remember it's state for refresh
                    if (this.rootLayer && !this.serviceLayer && !this.legend) {
                        this.rootLayerTOC.config.collapsed = domClass.contains(this.iconNode, 'dijitTreeExpandoClosed');
                    }
                }
            },
            /**
             * Expand the node's children if applicable
             */
            expand: function () {
                this._toggleContainer(true);
            },
            /**
             * collapse the node's children if applicable
             */
            collapse: function () {
                this._toggleContainer(false);
            },
            /**
             * Show the TOC Node
             */
            show: function () {
                domStyle.set(this.containerNode, "display", "block");
            },
            /** Hide TOC node
             * 
             */
            hide: function () {
                domStyle.set(this.containerNode, "display", "none");
            },
            // change UI according to the state of map layers. 
            _adjustToState: function () {
                if (this.checkNode) {
                    var checked = this.legend ? this.legend.visible : this.serviceLayer ? this.serviceLayer.visible : this.rootLayer ? this.rootLayer.visible : false;
                    if (this.checkNode.set) {
                        //checkNode is a dojo.forms.CheckBox
                        this.checkNode.set('checked', checked);
                    } else {
                        // checkNode is a simple HTML element.
                        this.checkNode.checked = checked;
                    }
                }
                if (this.serviceLayer) {
                    var scale = this.mapView.scale;
                    var outScale = (this.serviceLayer.maxScale != 0 && scale < this.serviceLayer.maxScale) || (this.serviceLayer.minScale != 0 && scale > this.serviceLayer.minScale);
                    if (outScale) {
                        domClass.add(this.domNode, 'agsjsTOCOutOfScale');
                    } else {
                        domClass.remove(this.domNode, 'agsjsTOCOutOfScale');
                    }
                    if (this.checkNode) {
                        if (this.checkNode.set) {
                            this.checkNode.set('disabled', outScale);
                        } else {
                            this.checkNode.disabled = outScale;
                        }
                    }
                }
                if (this._childTOCNodes.length > 0) {
                    array.forEach(this._childTOCNodes, function (child) {
                        child._adjustToState();
                    });
                }
            },
            _onClick: function (evt) {
                var t = evt.target;
                var lay;
                if (t == this.checkNode || dijit.getEnclosingWidget(t) == this.checkNode) {
                    // 2013-07-23: remove this most complex checkable legend functionality to simplify the widget
                    if (this.serviceLayer) {
                        this.serviceLayer.visible = this.checkNode.checked;
                        // if a sublayer is checked on, force it's group layer to be on. 
                        // 2013-08-01 handler multiple level of groups
                        if (this.serviceLayer.visible) {
                            lay = this.serviceLayer;
                            while (lay._parentLayerInfo) {
                                if (!lay._parentLayerInfo.visible) {
                                    lay._parentLayerInfo.visible = true;
                                }
                                lay = lay._parentLayerInfo;
                            }
                        }
                        // if a layer is on, it's service must be on.
                        if (this.serviceLayer.visible && !this.rootLayer.visible) {
                            this.rootLayer.visible = true;
                        }
                        if (this.serviceLayer._subLayerInfos) {
                            this._setSubLayerVisibilitiesFromGroup(this.serviceLayer);
                        }

                    } else if (this.rootLayer) {
                        this.rootLayer.visible = this.checkNode.checked;
                    }
                    // automatically expand/collapse?
                    if (this.rootLayerTOC.config.autoToggle !== false) {
                        this._toggleContainer(this.checkNode.checked);
                    }
                    this.rootLayerTOC._adjustToState();

                } else if (t == this.iconNode) {
                    this._toggleContainer();
                }
            },
            _setSubLayerVisibilitiesFromGroup: function (lay) {
                ;
                if (lay._subLayerInfos && lay._subLayerInfos.length > 0) {
                    array.forEach(lay._subLayerInfos, function (info) {
                        info.visible = lay.visible;
                        if (info._subLayerInfos && info._subLayerInfos.length > 0) {
                            this._setSubLayerVisibilitiesFromGroup(info);
                        }
                    }, this);
                }
            },
            _getVisibleLayers: function () {
                var vis = [];
                array.forEach(this.rootLayer.allSublayers.items, function (layerInfo) {
                    if (layerInfo.subLayerIds) {
                        // if a group layer is set to vis, all sub layer will be drawn regardless it's sublayer status
                        return;
                    } else if (layerInfo.visible) {
                        vis.push(layerInfo.id);
                    }
                });
                if (vis.length === 0) {
                    vis.push(-1);
                } else if (!this.rootLayer.visible) {
                    this.rootLayer.visible = true;
                }
                return vis;
            }
            , _findTOCNode: function (layerId) {
                if (this.serviceLayer && this.serviceLayer.id == layerId) {
                    return this;
                }
                if (this._childTOCNodes.length > 0) {
                    var n = null;
                    for (var i = 0, c = this._childTOCNodes.length; i < c; i++) {
                        n = this._childTOCNodes[i]._findTOCNode(layerId);
                        if (n) return n;
                    }
                }
                return null;
            }
        });

        var _RootLayerTOC = declare([_Widget], {
            _currentIndent: 0,
            rootLayer: null,
            tocWidget: null,
            /**
             *
             * @param {Object} params: noLegend: true|false, collapsed: true|false, slider: true|false
             * @param {Object} srcNodeRef
             */
            constructor: function (params, srcNodeRef) {
                this.config = params.config || {};
                this.rootLayer = params.config.layer;
                this.tocWidget = params.tocWidget;
                this.mapView = params.mapView;
                this.strTokenKey = params.strTokenKey;
            },
            // extenstion point called by framework
            postCreate: function () {
                if ((this.rootLayer instanceof (MapImageLayer) || this.rootLayer instanceof (FeatureLayer) ||
                    this.rootLayer instanceof (TileLayer))) {
                    if (this._legendResponse) {
                        this._createRootLayerTOC();
                    } else {
                        this._getLegendInfo();
                    }
                } else {
                    this._createRootLayerTOC();
                }
            },

            _getLegendInfo: function () {

                var url = '';
                var arr = this.rootLayer.url.split("?");
                url = arr[0];
                var resBool = false;
                var resJSON;

                var data = new FormData();
                data.append('f', 'pjson');
                var tokenkey = this.strTokenKey;
                if (typeof tokenkey !== 'undefined'){
                    data.append('token', tokenkey);
                }
                    

                var xhttp = new XMLHttpRequest();
                xhttp.onreadystatechange = function () {
                    if (xhttp.readyState === 4) {
                        var response = JSON.parse(xhttp.responseText);
                        if (xhttp.status === 200 && xhttp.statusText === 'OK') {
                            resBool = true;
                            resJSON = response
                        } else {
                            resBool = false;
                            resJSON = response
                        }
                    }
                }
                xhttp.open("POST", url + '/legend', false);
                xhttp.send(data);

                if (resBool) {
                    this._processLegendInfo(resJSON);
                }
                else
                    this._createRootLayerTOC();

            },
            _processLegendError: function (err) {
                this._createRootLayerTOC();
            },
            _processLegendInfo: function (json) {
                this._legendResponse = json;
                var layer = this.rootLayer;

                //Incase of FeatureLayer 
                if (layer instanceof FeatureLayer || layer instanceof TileLayer) {
                    layer.allSublayers = {
                        items: [layer]
                    }
                }

                var visibleLayers = [];


                for (let i = 0; i < layer.allSublayers.items.length; i++) {
                    if (layer.allSublayers.items[i].visible)
                        visibleLayers.push(layer.allSublayers.items[i].id);
                }

                if (!layer._tocInfos) {

                    // create a lookup map, key=layerId, value=LayerInfo
                    // generally id = index, this is to assure we find the right layer by ID
                    // note: not all layers have an entry in legend response.
                    var layerLookup = {};
                    array.forEach(layer.allSublayers.items, function (layerInfo) {
                        layerLookup['' + layerInfo.id] = layerInfo;
                        // used for later reference.

                        if (layerInfo instanceof FeatureLayer || layerInfo instanceof TileLayer) {
                            layerInfo.visible = true;
                        }
                        else {
                            let newlayerInfoStr = JSON.stringify(layerInfo);
                            let newlayerInfo = JSON.parse(newlayerInfoStr);
                            layerInfo.visible = newlayerInfo.defaultVisibility;
                        }

                        if (visibleLayers && !layerInfo.sublayers) {
                            if (array.indexOf(visibleLayers, layerInfo.id) == -1) {
                                layerInfo.visible = false;
                            } else {
                                layerInfo.visible = true;
                            }
                        }
                    });
                    // attached legend Info to layer info
                    if (json.layers) {
                        array.forEach(json.layers, function (legInfo) {
                            var layerInfo = layerLookup['' + legInfo.layerId];
                            if (layerInfo && legInfo.legend) {
                                layerInfo._legends = legInfo.legend;
                            }
                            else if (layer instanceof FeatureLayer || layer instanceof TileLayer) {
                                layer._legends = legInfo.legend;
                            }
                        });
                    }
                    // nest layer Infos
                    array.forEach(layer.allSublayers.items, function (layerInfo) {
                        if (layerInfo.sublayers) {

                            var subLayerInfos = [];
                            array.forEach(layerInfo.sublayers.items, function (lyr, i) {
                                subLayerInfos[i] = layerLookup[lyr.id];
                                subLayerInfos[i]._parentLayerInfo = layerInfo;
                            });
                            layerInfo._subLayerInfos = subLayerInfos;
                        }
                    });

                    //finalize the tree structure in _tocInfos, skipping all sublayers because they were nested already.
                    var tocInfos = [];
                    array.forEach(layer.allSublayers.items, function (layerInfo) {


                        if (layerInfo instanceof FeatureLayer || layerInfo instanceof TileLayer) {
                            tocInfos.push(layerInfo);
                        }

                        else {
                            let newlayerInfoStr = JSON.stringify(layerInfo);
                            let newlayerInfo = JSON.parse(newlayerInfoStr);

                            if (newlayerInfo.parentLayerId == -1) {
                                tocInfos.push(layerInfo);
                            }
                        }
                    });
                    layer._tocInfos = tocInfos;
                }
                this._createRootLayerTOC();
            },
            _createRootLayerTOC: function () {

                // sometimes IE may fail next step

                this._rootLayerNode = new _TOCNode({
                    rootLayerTOC: this,
                    rootLayer: this.rootLayer,
                    mapView: this.mapView
                });
                this._rootLayerNode.placeAt(this.domNode);
                this._visHandler = dojo.connect(this.rootLayer, "onVisibilityChange", this, "_adjustToState");
                // this will make sure all TOC linked to a Map synchronized.
                if (this.rootLayer instanceof (MapImageLayer)) {
                    this._visLayerHandler = dojo.connect(this.rootLayer, "setVisibleLayers", this, "_onSetVisibleLayers");
                }
                this._adjustToState();
                this._loaded = true;
                this.onLoad();
            },
            /**
             * @event
             */
            onLoad: function () {

            },
            _refreshLayer: function () {
                var rootLayer = this.rootLayer;
                var timeout = this.tocWidget.refreshDelay;

                var visibleLayers = [];

                for (let i = 0; i < rootLayer.allSublayers.items.length; i++) {
                    if (rootLayer.allSublayers.items[i].visible)
                        visibleLayers.push(rootLayer.allSublayers.items[i].id);
                }
                if (this._refreshTimer) {
                    window.clearTimeout(this._refreshTimer);
                    this._refreshTimer = null;
                }
                this._refreshTimer = window.setTimeout(function () {
                    //rootLayer.setVisibleLayers(rootLayer.visibleLayers);
                    for (let i = 0; i < visibleLayers.length; i++) {
                        let subID = visibleLayers[i];

                        if (rootLayer.allSublayers.items.indexOf(rootLayer.allSublayers.items[subID]) != -1) {
                            rootLayer.allSublayers.items[subID].visible = true;
                        }

                    }
                }, timeout);
            },
            _onSetVisibleLayers: function (visLayers, doNotRefresh) {
                if (!doNotRefresh) {
                    array.forEach(this.rootLayer.allSublayers.items, function (layerInfo) {
                        if (array.indexOf(visLayers, layerInfo.id) != -1) {
                            layerInfo.visible = true;
                        } else if (!layerInfo._subLayerInfos) {
                            layerInfo.visible = false;
                        }
                    });
                    this._adjustToState();
                }
            },
            _adjustToState: function () {
                this._rootLayerNode._adjustToState();
            },
            destroy: function () {
                dojo.disconnect(this._visHandler);
                if (this._visLayerHandler)
                    dojo.disconnect(this._visLayerHandler);
            }
        });

        var TOC = declare("agsjs.dijit.TOC", [_Widget], {
            indentSize: 18,
            swatchSize: [30, 30],
            refreshDelay: 500,
            layerInfos: null,

            /**
             * @name TOCLayerInfo
             * @class This is an object literal that specify the options for each map rootLayer layer.
             * @property {Layer} [layer] ArcGIS Server layer.
             * @property {string} [title] title. optional. If not specified, rootLayer name is used.
             * @property {Boolean} [slider] whether to show slider for each rootLayer to adjust transparency. default is false.
             * @property {Boolean} [noLegend] whether to skip the legend, and only display layers. default is false.
             * @property {Boolean} [collapsed] whether to collapsed the rootLayer layer at beginning. default is false, which means expand if visible, collapse if not.
             *
             */
            /**
             * @name TOCOptions
             * @class This is an object literal that specify the option to construct a {@link TOC}.
             * @property {esri.Map} [map] the map instance. required.
             * @property {Object[]} [layerInfos] a subset of layers in the map to show in TOC. each object is a {@link TOCLayerInfo}
             * @property {Number} [indentSize] indent size of tree nodes. default to 18.
             */
            /** 
             * Create a Table Of Contents (TOC)
             * @name TOC
             * @constructor
             * @class This class is a Table Of Content widget.
             * @param {ags.TOCOptions} opts
             * @param {DOMNode|id} srcNodeRef
             */
            constructor: function (params, srcNodeRef) {
                params = params || {};
                if (!params.map) {
                    throw new Error('no map defined in params for TOC');
                }
                this.layerInfos = params.layerInfos;
                dojo.mixin(this, params);
            },
            // extension point
            postCreate: function () {
                this._createTOC();
            },
            /** @event the widget DOM is loaded
             *
             */
            onLoad: function () {
            },
            _createTOC: function () {
                domContruct.empty(this.domNode);
                this._rootLayerTOCs = [];
                for (var i = 0, c = this.layerInfos.length; i < c; i++) {
                    // attach a title to rootLayer layer itself
                    var info = this.layerInfos[i];

                    var rootLayerTOC = new _RootLayerTOC({
                        config: info,
                        tocWidget: this,
                        mapView: this.mapView,
                        strTokenKey:this.tokenKey
                    });
                    this._rootLayerTOCs.push(rootLayerTOC);
                    this._checkLoadHandler = dojo.connect(rootLayerTOC, 'onLoad', this, '_checkLoad');
                    rootLayerTOC.placeAt(this.domNode);
                    this._checkLoad();
                }
                if (!this._zoomHandler) {
                    this._zoomHandler = dojo.connect(this.map, "onZoomEnd", this, "_adjustToState");
                }
            },
            _checkLoad: function () {
                var loaded = true;
                array.every(this._rootLayerTOCs, function (widget) {
                    if (!widget._loaded) {
                        loaded = false;
                        return false;
                    }
                    return true;
                });
                if (loaded) {
                    this.onLoad();
                }
            },
            _adjustToState: function () {
                array.forEach(this._rootLayerTOCs, function (widget) {
                    widget._adjustToState();
                });
            },
            /**
             * Refresh the TOC to reflect
             */
            refresh: function () {
                this._createTOC();
            },
            destroy: function () {
                dojo.disconnect(this._zoomHandler);
                this._zoomHandler = null;
                dojo.disconnect(this._checkLoadHandler);
                this._checkLoadHandler = null;
            },
            /**
             * Find the TOC Node based on root layer and optional serviceLayer ID. 
             * @param {Object} layer root Layer of a map
             * @param {Object} serviceLayerId id of a ArcGIS Map Service Layer
             * @return {TOCNode} TOC node, it has public methods: collapse, expand, show, hide
             */
            findTOCNode: function (layer, serviceLayerId) {
                var w;
                array.every(this._rootLayerTOCs, function (widget) {
                    if (widget.rootLayer == layer) {
                        w = widget;
                        return false;
                    }
                    return true;
                });
                if (serviceLayerId !== null && serviceLayerId !== undefined && w.rootLayer instanceof (MapImageLayer)) {
                    return w._rootLayerNode._findTOCNode(serviceLayerId);
                } else if (w) {
                    return w._rootLayerNode;
                }
                return null;
            }
        });
        return TOC;

    });
