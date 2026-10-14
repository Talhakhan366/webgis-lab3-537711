
const useCanvas = new URLSearchParams(window.location.search).has('canvas');

const map = L.map('map', {
    center: [30.3753, 69.3451],
    zoom: 5,
    minZoom: 5,
    maxZoom: 14,
    maxBounds: [[21.5, 58.5], [39.0, 80.5]],
    maxBoundsViscosity: 1.0,
    preferCanvas: useCanvas
});

// Basemaps
const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
});

const positron = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }
);

const imagery = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri'
    }
);

positron.addTo(map);

const layerControl = L.control.layers({
    'Light (Carto Positron)': positron,
    'OpenStreetMap': osm,
    'Satellite (Esri)': imagery
}, {}, { collapsed: false }).addTo(map);

L.control.scale({ imperial: false }).addTo(map);

// Population density
function densityOf(properties) {
    const population = Number(properties.pop_2023);
    const area = Number(properties.area_km2);

    if (
        properties.pop_2023 == null ||
        properties.area_km2 == null ||
        properties.pop_2023 === '' ||
        properties.area_km2 === '' ||
        !Number.isFinite(population) ||
        !Number.isFinite(area) ||
        area <= 0
    ) {
        return null;
    }

    return population / area;
}

function colourFor(density) {
    if (density === null) return '#c9cfd1';
    if (density > 1000) return '#08306b';
    if (density > 400) return '#2171b5';
    if (density > 150) return '#4292c6';
    if (density > 50) return '#9ecae1';
    return '#deebf7';
}

function styleFor(feature) {
    return {
        color: '#ffffff',
        weight: 1,
        fillColor: colourFor(densityOf(feature.properties)),
        fillOpacity: 0.8
    };
}

// Population circle settings
map.createPane('symbols');
map.getPane('symbols').style.zIndex = 450;

function radiusFor(population) {
    return Math.sqrt(population) / 160;
}

function hasPopulation(feature) {
    const value = feature.properties.pop_2023;

    return value !== null &&
        value !== undefined &&
        value !== '' &&
        Number.isFinite(Number(value)) &&
        Number(value) >= 0;
}

function circleFor(feature, latlng) {
    const population = Number(feature.properties.pop_2023);

    return L.circleMarker(latlng, {
        pane: 'symbols',
        radius: radiusFor(population),
        color: '#7c2d12',
        weight: 1,
        fillColor: '#f97316',
        fillOpacity: 0.7
    }).bindTooltip(
        (feature.properties.district || 'District') +
        ': ' + population.toLocaleString()
    );
}

// Layer groups
const districtGroup = L.featureGroup().addTo(map);
const circleGroup = L.featureGroup().addTo(map);

layerControl.addOverlay(districtGroup, 'Population density');
layerControl.addOverlay(circleGroup, 'Population');

// NUST: 25 km radius and 6 pixel circle marker
const nust = [33.6423, 72.9906];

const nustGroup = L.featureGroup([
    L.circle(nust, {
        radius: 25000,
        color: '#0f766e',
        weight: 2,
        fillOpacity: 0.08
    }),
    L.circleMarker(nust, {
        radius: 6,
        color: '#0f766e',
        fillColor: '#0f766e',
        fillOpacity: 1
    })
]).bindTooltip('NUST H-12: 25 km circle and 6 pixel circleMarker');

layerControl.addOverlay(nustGroup, 'NUST, 25 km');

// Information panel
const info = L.control({ position: 'topright' });

info.onAdd = function () {
    this._div = L.DomUtil.create('div', 'info');
    L.DomEvent.disableClickPropagation(this._div);
    L.DomEvent.disableScrollPropagation(this._div);
    this.update();
    return this._div;
};

info.update = function (properties) {
    const zoom = '<div class="muted">Zoom level ' +
        map.getZoom() + '</div>';

    if (!properties) {
        this._div.innerHTML =
            '<h4>District</h4>' +
            '<div class="muted">Hover over a district</div>' + zoom;
        return;
    }

    const density = densityOf(properties);

    this._div.innerHTML =
        '<h4>' + (properties.district || 'District') + '</h4>' +
        (properties.province || 'Province not recorded') + '<br>' +
        'Population: ' + formatNumber(properties.pop_2023) + '<br>' +
        'Area: ' + formatNumber(properties.area_km2) +
        ' km<sup>2</sup><br>' +
        'Density: ' +
        (density === null
            ? 'not recorded'
            : Math.round(density).toLocaleString() +
              ' per km<sup>2</sup>') + zoom;
};

function formatNumber(value) {
    if (value === null || value === undefined || value === '') {
        return 'not recorded';
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number.toLocaleString()
        : value;
}

info.addTo(map);

// District interactions
let districts = null;

function highlight(event) {
    event.target.setStyle({
        weight: 3,
        color: '#1a202c',
        fillOpacity: 0.95
    });

    event.target.bringToFront();
    info.update(event.target.feature.properties);
}

function unhighlight(event) {
    if (districts) {
        districts.resetStyle(event.target);
    }

    info.update();
}

function zoomToDistrict(event) {
    map.fitBounds(event.target.getBounds(), {
        padding: [20, 20]
    });
}

function bindDistrict(feature, layer) {
    layer.bindTooltip(
        feature.properties.district || 'District',
        { sticky: true }
    );

    layer.on({
        mouseover: highlight,
        mouseout: unhighlight,
        click: zoomToDistrict
    });
}

// Load GeoJSON data
let allDistricts = null;
let allPoints = null;

async function loadJSON(path) {
    const response = await fetch(path);

    if (!response.ok) {
        throw new Error(
            path + ': HTTP status ' + response.status
        );
    }

    return response.json();
}

function fillProvinceList() {
    const select = document.getElementById('province');

    const provinces = [
        ...new Set(
            allDistricts.features.map(
                feature => feature.properties.province
            )
        )
    ].filter(Boolean).sort();

    select.querySelectorAll(
        'option:not([value="all"])'
    ).forEach(option => option.remove());

    provinces.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });
}

// Draw districts and population circles
function draw(province) {
    if (!allDistricts || !allPoints) return;

    const startTime = performance.now();

    function keep(feature) {
        return province === 'all' ||
            feature.properties.province === province;
    }

    districtGroup.clearLayers();
    circleGroup.clearLayers();

    districts = L.geoJSON(allDistricts, {
        filter: keep,
        style: styleFor,
        onEachFeature: bindDistrict
    });

    districtGroup.addLayer(districts);

    const pointsLayer = L.geoJSON(allPoints, {
        filter: function (feature) {
            return keep(feature) && hasPopulation(feature);
        },
        pointToLayer: circleFor
    });

    circleGroup.addLayer(pointsLayer);

    const count = districts.getLayers().length;

    document.getElementById('count').textContent =
        count + ' districts';

    if (count > 0) {
        map.fitBounds(districts.getBounds());
    }

    info.update();

    console.log(
        'draw(' + province + '): ' + count +
        ' districts in ' +
        (performance.now() - startTime).toFixed(1) +
        ' ms; ' + (useCanvas ? 'canvas' : 'SVG')
    );
}

// Province selector
document.getElementById('province').addEventListener(
    'change',
    function (event) {
        draw(event.target.value);
    }
);

// Optional coordinate popup
function showCoordinates(event) {
    L.popup()
        .setLatLng(event.latlng)
        .setContent(
            event.latlng.lat.toFixed(4) + ', ' +
            event.latlng.lng.toFixed(4)
        )
        .openOn(map);
}

document.getElementById('coords').addEventListener(
    'change',
    function (event) {
        if (event.target.checked) {
            map.on('click', showCoordinates);
        } else {
            map.off('click', showCoordinates);
        }
    }
);

map.on('zoomend', function () {
    info.update();
});

// Legend
const legend = L.control({ position: 'bottomright' });

legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'legend');

    const breaks = [0, 50, 150, 400, 1000];
    const labels = [
        'under 50',
        '50 to 150',
        '150 to 400',
        '400 to 1,000',
        'over 1,000'
    ];

    div.innerHTML =
        '<strong>People per km<sup>2</sup></strong><br>';

    for (let i = 0; i < breaks.length; i++) {
        div.innerHTML +=
            '<i style="background:' +
            colourFor(breaks[i] + 1) +
            '"></i> ' + labels[i] + '<br>';
    }

    div.innerHTML +=
        '<i style="background:' + colourFor(null) +
        '"></i> no census data';

    const sizes = [10000000, 4000000, 1000000];
    const maxRadius = radiusFor(sizes[0]);
    const base = 6 + 2 * maxRadius;

    let svg = '<svg width="' + (2 * maxRadius + 95) +
        '" height="' + (base + 2) + '">';

    for (const size of sizes) {
        const radius = radiusFor(size);
        const y = base - 2 * radius;

        svg +=
            '<circle cx="' + (maxRadius + 1) +
            '" cy="' + (base - radius) +
            '" r="' + radius +
            '" fill="#f97316" fill-opacity=".2" ' +
            'stroke="#7c2d12"/>' +

            '<line x1="' + (maxRadius + 1) +
            '" y1="' + y +
            '" x2="' + (2 * maxRadius + 14) +
            '" y2="' + y +
            '" stroke="#7c2d12" stroke-width=".6"/>' +

            '<text x="' + (2 * maxRadius + 17) +
            '" y="' + (y + 3.5) +
            '" font-size="10">' +
            (size / 1000000) + ' million</text>';
    }

    svg += '</svg>';

    div.innerHTML +=
        '<div class="circles"><strong>Population</strong>' +
        svg + '</div>';

    L.DomEvent.disableClickPropagation(div);

    return div;
};

legend.addTo(map);

// Start loading the data
async function loadData() {
    try {
        [allDistricts, allPoints] = await Promise.all([
            loadJSON('data/districts.geojson'),
            loadJSON('data/district_points.geojson')
        ]);

        if (
            !allDistricts.features ||
            !allPoints.features
        ) {
            throw new Error(
                'A GeoJSON file is missing its features array.'
            );
        }

        fillProvinceList();
        draw('all');

    } catch (error) {
        console.error(
            'Could not load dashboard data:',
            error
        );

        document.getElementById('count').textContent =
            'Data failed to load';

        alert(
            'Dashboard data could not be loaded. Check that ' +
            'both GeoJSON files are in the data folder and ' +
            'that you opened the page using Live Server. ' +
            'Check the browser Console for details.'
        );
    }
}

loadData();
