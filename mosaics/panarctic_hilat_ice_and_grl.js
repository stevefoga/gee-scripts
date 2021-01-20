//var geom = ee.FeatureCollection('users/sfoga/grl_tiles_dissolve_webmercator');
var geom = ee.FeatureCollection('users/sfoga/nongrl_tiles_polarice_webmercator_and_grl_dissolve');
var modis_water_mask = ee.Image("MODIS/MOD44W/MOD44W_005_2000_02_24");

// Load Landsat 8 TOA Tier 1 and Tier 2
// (interior Greenland does not exist in Tier 1 due to lack of GCPs)
var l8_t1 = ee.ImageCollection('LANDSAT/LC08/C01/T1_TOA');
var l8_t2 = ee.ImageCollection('LANDSAT/LC08/C01/T2_TOA');
var l8toa = l8_t1.merge(l8_t2);


// Function to mask cloud from the BQA band of Landsat 8 TOA data.
function maskL8toa(image) {
  var cirrusBitMask = ee.Number(2).pow(12).int(); // high and medium conf
  var cloudsBitMask = ee.Number(2).pow(4).int();

  // Get the BQA band.
  var qa = image.select('BQA');

  // Mask cloud and cirrus
  var mask = qa.bitwiseAnd(cloudsBitMask).eq(0)
      .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  //var mask = qa.bitwiseAnd(cloudsBitMask).eq(0)

  return image.updateMask(mask);
}


// median() statistics seems to produce less artifacts than mean()
var _toa_composite_median = l8toa.filter(ee.Filter.gt('SUN_ELEVATION', 20))
                      .map(maskL8toa)
                      .median();

// get water mask
var waterMask = modis_water_mask.select('water_mask');
var mask = waterMask.eq(0);

// buffer water mask so land/ice features aren't excluded
// 3,500 meters seems to work best with GEE's kernel limit
// ref 1: https://gis.stackexchange.com/a/318716
// ref 2: https://developers.google.com/earth-engine/apidocs/ee-image-focal_max#javascript
var mask_buffer = mask.focal_max(3500, 'circle', 'meters');

// make all non-land pixels 'water' so it can be assigned a uniform color when mosaicked
var mask_buffer_water = mask_buffer.not();
//var mask_buffer = mask_buffer.mask(mask_buffer_water)

// apply mask to compsite
var toa_composite_median = _toa_composite_median.updateMask(mask_buffer)


//var toa_8bit = toa_composite_median.select('B8').multiply(512).uint8();
Map.setCenter(58.73, 81.83, 8);
//Map.addLayer(toa_8bit, {min: 1, max: 250}, 'pan')

var rgb = toa_composite_median.select('B4', 'B3', 'B2');
var pan = toa_composite_median.select('B8');

// Convert to HSV, swap in the pan band, and convert back to RGB.
var huesat = rgb.rgbToHsv().select('hue', 'saturation');
var upres = ee.Image.cat(huesat, pan).hsvToRgb();

// 1) apply water buffer (mask_buffer_water) with constant color palette
// 2) apply color correction to RGB image
// min=0.0 and max=0.82 seems to show both ice and geology well
var imageRGB = ee.ImageCollection([mask_buffer_water.visualize({palette: '000044'}),
upres.visualize({min: 0.0, max:0.82,
              gamma:[
                1.05, // red
                1.08, // green
                0.8]  // blue
}),
]).mosaic();

Map.addLayer(imageRGB, {}, 'rgb');
var imageRGB_red = imageRGB.select('vis-red');
var imageRGB_green = imageRGB.select('vis-green');
var imageRGB_blue = imageRGB.select('vis-blue');
//var properties = imageRGB_red.propertyNames();
//print(properties);
/*Export.image.toDrive({
  image: toa_8bit,
  description: 'panarctic_l8_pan_3413_15m',
  scale: 15,
  folder: 'ak_pan',
  crs: 'EPSG:3413',
  region: geom,
  maxPixels: 10000000000000
});*/
//var geom = ee.Geometry.Rectangle([-78, 59, -10, 90]);

// export final rgb image to drive
/*Export.image.toDrive({
  image: imageRGB.clip(geom),
  description: 'hilat_ice_and_grl_l8_rgb_3413_15m',
  scale: 15,
  folder: 'hilat_ice_and_grl_rgb',
  crs: 'EPSG:3413',
  region: geom,
  maxPixels: 10000000000000
});*/
Export.image.toDrive({
  image: imageRGB_red,
  description: 'hilat_ice_and_grl_l8_red_3413_15m',
  scale: 15,
  folder: 'hilat_ice_and_grl_rgb',
  crs: 'EPSG:3413',
  region: geom,
  maxPixels: 10000000000000
});

Export.image.toDrive({
  image: imageRGB_green,
  description: 'hilat_ice_and_grl_l8_green_3413_15m',
  scale: 15,
  folder: 'hilat_ice_and_grl_rgb',
  crs: 'EPSG:3413',
  region: geom,
  maxPixels: 10000000000000
});

Export.image.toDrive({
  image: imageRGB_blue,
  description: 'hilat_ice_and_grl_l8_blue_3413_15m',
  scale: 15,
  folder: 'hilat_ice_and_grl_rgb',
  crs: 'EPSG:3413',
  region: geom,
  maxPixels: 10000000000000
});