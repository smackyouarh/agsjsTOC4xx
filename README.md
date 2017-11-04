# agsjsTOC4xx
Table of Contents (TOC)/Legend Widget for Arcgis JavaScript API version 4.xx

Custom Widget for Arcgis JavaScript developers using JSAPI 4.xx and above based on Table of Content (TOC) for ArcGIS JavaScript API originally created by Nianwei Liu (nliu) at https://www.arcgis.com/home/item.html?id=9b6280a6bfb0430f8d1ebc969276b109

Original widget only supported Arcgis Javascript version 3.xx and did not work with version 4.xx due to many property changes of different Classes in and legacy calling disabled in version 4 ( dojo.require )

Credits to Nianwei Liu (nliu) for original widget

Live Demo: https://toc4xxtest.appspot.com/

Current supported layer types: MapImageLayer, FeatureLayer, TileLayer(Not fully working)

Known Issues: All legends for TileLayer will not display, working on a work around currently

Usage:


1. Add required Files (Note: claro theme is required for widget for display properly)
```html
<link rel="stylesheet" href="css/TOC.css">
<link rel="stylesheet" href="https://js.arcgis.com/4.5/dijit/themes/claro/claro.css">
<script src="https://js.arcgis.com/4.5/"></script>
<script src="js/TOC_4xx.js"></script>
```

2. Creating toc Object
```javascript
require(["agsjs/dijit/TOC"], function () {

    var tocLegend = new agsjs.dijit.TOC({
        map: map, //Your map object *required
        layerInfos: [{ // An array of objects consisting of your layer object, layer title
            layer: layer1,
            title: layer1.title,
            slider: true, //optional
            autoToggle: false //optional
        }], 
        mapView: mapView, // Your MapView or SceneView object * required
        tokenKey: tokenKey // Your tokenkey if your map service requires a token, comment if not needed
    }, "tocDiv" // the <div> you want your TOC widget to be
    );

    tocLegend.startup();

});
```
Even though you can straight away add layers into layerInfos, its recommended you wait for the layer to finish loading before adding to layerInfos.

Suggested practice:

```javascript

lyr.watch('loaded', function (newVal, oldval) { // lyr is my layer object
    if (newVal) { 
        tocLegend.layerInfos = []; // in this case, tocLegend is my agsjs.dijit.TOC object
        for (let i = 0; i < map.layers.length; i++) {
            tocLegend.layerInfos.push({
                layer: map.layers.items[i],
                title: map.layers.items[i].title,
                slider: true,
                autoToggle: false
            });
        }
        tocLegend.refresh(); //Refresh the widget
    }
});

```
Feel free to email any issues, bugs and suggestions to anghiaplee95@gmail.com
