# GPX editor

If you're using GPS trackers like Endomondo and sometimes forget to stop the app when entering the car, your training data is broken. Endomondo can figure that out and it doesn't count the training if the speed is too high.

This tool aims at "repairing" the GPX files by showing you a nice interface where you can:

* load a GPX file (export that from Endomondo)
* see an overview of your training along with the map
* choose parts of the track you want to save
* save a GPX file back

You can then upload the fixed GPX file back to Endomondo.

# Technology

The editor is 100% HTML5 and can even work offine (sans maps) and uses the following libs:

* jQuery
* Bootstrap
* Leaflet
* Google Charts
* Function to compute distance from this here: https://github.com/chrisveness/geodesy/blob/master/latlon-spherical.js
* OpenStreetMaps

GPX files never leave your computer. All the computations are done in the browser. The only outbound requests are issues to fetch the map tiles.
