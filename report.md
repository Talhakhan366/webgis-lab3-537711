# Lab 3 Report: District Dashboard

- **Course:** Web GIS, MS Remote Sensing and GIS, IGIS, NUST
- **Name:** Muhammad Talha Abdullah Khan
- **Roll number:** 537711
- **Repository:** https://github.com/Talhakhan366/webgis-lab3-537711
- **Live map:** https://talhakhan366.github.io/webgis-lab3-537711/

## 1. Checkpoint screenshots

**Checkpoint 1**

![Checkpoint 1](screenshots/Screenshot%202026-10-13%20175520.png)

**Checkpoint 2**

![Checkpoint 2](screenshots/Screenshot%202026-10-13%20180025.png)

**Checkpoint 3**

![Checkpoint 3](screenshots/Screenshot%202026-10-13%20182642.png)

**Checkpoint 4**

![Checkpoint 4](screenshots/Screenshot%202026-10-13%20191650.png)

**Checkpoint 5**

![Checkpoint 5](screenshots/Screenshot%202026-10-13%20192602.png)

**Checkpoint 6**

![Checkpoint 6a](screenshots/Screenshot%202026-10-13%20192621.png)

![Checkpoint 6b](screenshots/Screenshot%202026-10-13%20193224.png)

**Checkpoint 7**

![Checkpoint 7](screenshots/Screenshot%202026-10-13%20193811.png)


**Checkpoint 8**

![Checkpoint 9, SVG](screenshots/Screenshot%202026-10-13%20195035.png)

![Checkpoint 9, canvas](screenshots/Screenshot%202026-10-13%20195236.png)

---

## 2. Point layer

| Item | Value |
|---|---|
| District whose centroid falls outside it | **SIBI** |
| `district_points.geojson` file size | **31 KB** |
| Feature count | **160** |

---

## 4. Notes from Part 7

1. **Clicking the sea, then a district, with the checkbox ticked.** Clicking the sea opened a popup showing the latitude and longitude. Clicking a district ran two handlers. `zoomToDistrict` zoomed the map to that district. The click also passed through to the map, so `showCoordinates` opened a coordinate popup as well.
2. **Clicking the legend.** With `disableClickPropagation` in place, no popup appeared. After I removed that line and reloaded, a click on the legend passed through to the map and opened a coordinate popup. I then restored the line.
3. **Unticking the checkbox.** Clicking the sea did nothing, which confirms that `map.off` removed the handler.

---

## 5. Province filter: Gilgit Baltistan

The count reads 14 districts, but no circles appear. None of Gilgit Baltistan's districts has a `pop_2023` value, so `hasPopulation` drops every one of them before `circleFor` runs. The polygons still draw, in the "no census data" grey.

The dashboard should tell the user this. Otherwise the circle layer looks broken, or the population looks like zero. A count such as "14 districts, 0 with census data" would remove the ambiguity.

---

## 6. SVG or canvas

| | SVG | Canvas |
|---|---|---|
| Runs of `draw(all)`, ms | 118, 144, 155, 181 | 86, 120, 124, 134 |
| `draw(all)`, median, ms | **149.5** | **122** |
| Elements inside `leaflet-overlay-pane` | One `<svg>` holding one `<path>` per district | One `<canvas>` |
| Hover highlight still works? | Yes | Yes |
| Can you inspect one district in Elements? | Yes | No |

Each renderer was reloaded four times, so each median is the mean of the two middle values.

Canvas was about 27 ms faster. With 160 polygons and 135 circles, that gap is close to the variation between reloads, so the two renderers perform about the same at this scale.

For the tehsil layer, which has several times as many features, each with more vertices, canvas should be clearly faster. SVG adds every feature to the DOM as its own element, so its cost grows steeply with the number of features. Canvas paints everything into a single element and keeps the DOM small. The cost is that individual features can no longer be inspected or styled through the DOM.

---

## 7. Answers to the questions

**Q1.** Chagai, in Balochistan, is very large but thinly populated. Because it covers so much ground, its total population is 269,192, so the Lab 2 map would make it look populous when it is one of the emptiest districts in the country. Lahore is small and holds more than 13 million people. Its polygon barely registers on a national map, so the map understates how concentrated its population is. In both cases, colouring by a count mostly repeats each district's area. Density removes area from the measure.

**Q2.** Lahore has about 13 million people, roughly 4.3 times the population of a 3 million district. If the radius followed population directly, Lahore's circle would have about 4.3² ≈ 19 times the area, because area grows with the square of the radius. The map would suggest Lahore holds about nineteen times as many people instead of about four times.

**Q3.** `draw` builds a new `L.geoJSON` layer every time the province changes and throws the old one away. A control holding the first layer would keep switching that discarded layer, and the visible layer would stop responding. `districtGroup` is created once and only its contents change, so the control's reference stays valid.

**Q4.** With the polygons and circles sharing one pane, draw order would depend on what was drawn last. Hovering a district calls `bringToFront`, which lifts that polygon above every other path in the pane, including the circles. The user would see the circle disappear under the district being hovered. `resetStyle` restores the colour but not the order, so the circle would stay hidden after the pointer moved on, and more circles would vanish the longer the user moved around the map.

**Q5.** `map.off` removes a listener by matching the exact function object that was passed to `map.on`. `showCoordinates` is named, so passing it to `off` hands over that same object. An anonymous function written inside `map.on(...)` is never stored anywhere, so nothing can be passed to `off` that matches it. Retyping the same code creates a new, different function object.

**Q6.** Use `L.circle` for a 25 km evacuation zone. Its radius is in metres, so at every zoom level it covers the real ground within 25 km. Use `L.circleMarker` to mark the campus on a national map. Its radius is in pixels, so it stays visible at the same size at any zoom. At zoom 5, a 25 km `L.circle` shrinks to a few pixels and is hard to see.

## Commit history

https://github.com/Talhakhan366/webgis-lab3-537711/commits/main