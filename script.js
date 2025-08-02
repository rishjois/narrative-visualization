let nvidia_data = [];

const svg = d3.select("svg")
const width = +svg.attr("width") - 100;
const height = +svg.attr("height") - 100;
const margin = { top: 30, right: 30, bottom: 30, left: 50 };

const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

const parseDate = d3.timeParse("%m/%d/%Y");
fullData = []
let animationFrame;
let animationSpeed = 50;
let lastFrameTime = null;
let i = 0;
let isPaused = true;


let x, y, xAxisGroup, yAxisGroup, line, path, pointsGroup;


let volumeY, volumeAxisGroup, volumePath, volumeAreaPath;
let showVolume = false;


// Zoom/Scroll
let currentXDomain, fullXDomain;
let visibleData;
let zoomRangeInMs;


// Candlesticks + Tooltips
let candleGroup, tooltip;


// Annotations
let annotationsVisible = true;
const annotationData = [
    {
      date: "07/27/2015",
      open: 0.48,
      title: "🧠 Before 2015 – NVIDIA's Rise",
      label: "NVIDIA GPUs were a big player in neural networks."
    },
    {
      date: "5/2/2016",
      open: 0.9,
      title: "📈 2016 – Pascal Architecture",
      label: "GTX 10-series GPUs exploded in popularity."
    },
    {
      date: "4/2/2018",
      open: 5.72,
      title: "💻 2018 – Data Center & AV",
      label: "NVIDIA invested in self-driving & data center AI."
    },
    {
      date: "4/1/2020",
      open: 6.39,
      title: "🌐 2020 – Pandemic & AI Boom",
      label: "Remote work & gaming demand skyrocketed."
    },
    {
      date: "1/4/2021",
      open: 13.1,
      title: "💡 2020–21 – Ampere & A100",
      label: "Standard for AI/ML across all cloud providers."
    },
    {
      date: "3/1/2023",
      open: 23.19,
      title: "🧬 2023 – GenAI & ChatGPT",
      label: "Demand for H100 GPUs exploded."
    },
    {
      date: "6/3/2024",
      open: 113.62,
      title: "🏢 2024 – $1T Market Cap",
      label: "One of the top 5 most valuable companies."
    },
    {
      date: "4/1/2025",
      open: 108.52,
      title: "💼 2025 – Blackwell GPU",
      label: "Anticipated launch continues AI momentum."
    }
];


async function init() {
    nvidia_data = await d3.csv("https://raw.githubusercontent.com/rishjois/narrative-visualization/refs/heads/main/nvidia.csv");

    fullData = nvidia_data.map(d => ({
        date: parseDate(d.Date),
        open: +d.Open,
        high: +d.High,
        low: +d.Low,
        close: +d.Close,
        volume: +d.Volume.replace(/,/g, "")
      })).sort((a, b) => a.date - b.date);
    
      setupChart();
      updateChart([]);
};

function setupChart() {
    
    x = d3.scaleTime()
      .domain([fullData[0].date, d3.timeMonth.offset(fullData[0].date, 1)])
      .range([0, width]);
  
    y = d3.scaleLinear()
      .domain([0, 1])
      .range([height, 0]);
  
    xAxisGroup = g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x));
  
    yAxisGroup = g.append("g")
      .call(d3.axisLeft(y));
  
    line = d3.line()
      .x(d => x(d.date))
      .y(d => y(d.open));
  
    path = g.append("path")
      .datum([])
      .attr("fill", "none")
      .attr("stroke", "black")
      .attr("stroke-width", 1);


    // ---- Volume graph stuff ----

    volumeY = d3.scaleLinear()
    .domain([0, d3.max(fullData, d => d.volume) * 1.1])
    .range([height, 0]);

    volumeAxisGroup = g.append("g")
    .attr("transform", `translate(${width}, 0)`)
    .call(d3.axisRight(volumeY))
    .style("display", "none"); // initially hidden

    const volumeLine = d3.line()
    .x(d => x(d.date))
    .y(d => volumeY(d.volume));

    const volumeArea = d3.area()
    .x(d => x(d.date))
    .y0(height)
    .y1(d => volumeY(d.volume));

    // Paths for volume chart
    volumePath = g.append("path")
    .datum([])
    .attr("fill", "none")
    .attr("stroke", "purple")
    .attr("stroke-width", 1.5)
    .style("display", "none");

    volumeAreaPath = g.append("path")
    .datum([])
    .attr("fill", "rgba(128, 0, 128, 0.2)")
    .style("display", "none");

    
    // ---- User Interaction ----

    currentXDomain = d3.extent(fullData, d => d.date);
    fullXDomain = d3.extent(fullData, d => d.date);
    zoomRangeInMs = fullXDomain[1] - fullXDomain[0];

    const zoom = d3.zoom()
        .filter(event => event.type === "wheel")
        .scaleExtent([1, fullData.length / 30]) // min: full range, max: ~1 month
        .translateExtent([[0, 0], [width, height]])
        .extent([[0, 0], [width, height]])
        .on("zoom", zoomed);

    svg.call(zoom).on("dblclick.zoom", null); // disable double-click zoom



    // ---- Candlesticks and Tooltips ----

    candleGroup = g.append("g").attr("class", "candlestick-group");
    tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("background", "#fff")
        .style("border", "1px solid #ccc")
        .style("padding", "6px")
        .style("border-radius", "4px")
        .style("font-size", "12px");

    pointsGroup = g.append("g");
}

function updateChart(currentData, animateAxes=true) {
    visibleData = currentData;

    // Update x domain
    const xMin = d3.min(currentData, d => d.date);
    const xMax = d3.max(currentData, d => d.date);
    x.domain([xMin, xMax]);

  
    // Update y domain
    const yMin = d3.min(currentData, d => d.open) || 0;
    const yMax = d3.max(currentData, d => d.open) || 1;
    y.domain([yMin, yMax]);

  
    if (animateAxes) {
        xAxisGroup.transition().duration(250).call(d3.axisBottom(x));
        yAxisGroup.transition().duration(250).call(d3.axisLeft(y));
    } else {
        xAxisGroup.call(d3.axisBottom(x));
        yAxisGroup.call(d3.axisLeft(y));
    }
  
    path.datum(currentData)
      .attr("d", line);

      // Update volume Y if visible
    if (showVolume) {
        volumeY.domain([0, d3.max(currentData, d => d.volume) * 1.1]);
    
        if (animateAxes) {
        volumeAxisGroup.transition().duration(250).call(d3.axisRight(volumeY));
        } else {
        volumeAxisGroup.call(d3.axisRight(volumeY));
        }
    
        volumePath
        .datum(currentData)
        .attr("d", d3.line()
            .x(d => x(d.date))
            .y(d => volumeY(d.volume))
        );
    
        volumeAreaPath
        .datum(currentData)
        .attr("d", d3.area()
            .x(d => x(d.date))
            .y0(height)
            .y1(d => volumeY(d.volume))
        );
    }


    pointsGroup.selectAll("circle")
        .data(currentData, d => d.date)
        .join(
            enter => enter.append("circle")
            .attr("r", 5)
            .attr("cx", d => x(d.date))
            .attr("cy", d => y(d.open))
            .attr("fill", "transparent")
            .on("mouseenter", (event, d) => {
                if ((currentXDomain[1] - currentXDomain[0]) > 1000 * 60 * 60 * 24 * 365 * 2) return; // > 3 months
                showCandlestick(d, x(d.date));
                showTooltip(d, event.pageX, event.pageY);
            })
            .on("mouseleave", (event, d) => {
                hideCandlestick(x(d.date), y(d.open));
                hideTooltip();
            }),
            update => update
            .attr("cx", d => x(d.date))
            .attr("cy", d => y(d.open))
        );
    

    // Reveal annotations within visible date range
    const visibleDates = new Set(currentData.map(d => d.date.toISOString()));

    d3.selectAll(".annotation")
    .transition()
    .duration(300)
    .style("opacity", function() {
        const annotationDate = this.getAttribute("data-date");
        return visibleDates.has(annotationDate) ? 1 : 0;
    });

    addAnnotations(currentData);

}
  
function animate(timestamp) {
    if (i >= fullData.length) return;

    if (!lastFrameTime) lastFrameTime = timestamp;
  
    if (timestamp - lastFrameTime >= animationSpeed) {
        const currentData = fullData.slice(0, i + 1);
        updateChart(currentData, false); // no axis transition
        i++;
        lastFrameTime = timestamp;
    }
  
    if (!isPaused && i < fullData.length) {
      animationFrame = requestAnimationFrame(animate);
    }
}

function zoomed(event) {
    const t = event.transform;
    const pointer = d3.pointer(event, svg.node());
    const mouseX = pointer[0] - margin.left;

    const zoomFactor = event.sourceEvent.deltaY < 0 ? 0.9 : 1.1;

    const x0 = x.invert(mouseX);
    let [xStart, xEnd] = currentXDomain;

    const range = xEnd - xStart;
    let newRange = range * zoomFactor;

    // Clamp to minimum 30 days
    const minRange = 1000 * 60 * 60 * 24 * 30;
    newRange = Math.max(minRange, Math.min(newRange, fullXDomain[1] - fullXDomain[0]));

    const half = newRange / 2;
    let newXStart = new Date(x0.getTime() - half);
    let newXEnd = new Date(x0.getTime() + half);

    // Clamp within full data domain
    if (newXStart < fullXDomain[0]) {
        newXEnd = new Date(newXEnd.getTime() + (fullXDomain[0] - newXStart));
        newXStart = fullXDomain[0];
    } else if (newXEnd > fullXDomain[1]) {
        newXStart = new Date(newXStart.getTime() - (newXEnd - fullXDomain[1]));
        newXEnd = fullXDomain[1];
    }

    currentXDomain = [newXStart, newXEnd];
    zoomRangeInMs = newXEnd - newXStart;

    visibleData = fullData.filter(d => d.date >= newXStart && d.date <= newXEnd);
    updateChart(visibleData, false);
}



function showCandlestick(d, cx) {
    const candleColor = d.close >= d.open ? "green" : "red";
    const candleWidth = 10;
  
    // Main candle body (open to close)
    candleGroup
      .append("rect")
      .attr("x", cx - candleWidth / 2)
      .attr("width", candleWidth)
      .attr("y", y(d.open))
      .attr("height", 0)
      .attr("fill", candleColor)
      .transition()
      .duration(200)
      .attr("y", Math.min(y(d.open), y(d.close)))
      .attr("height", Math.abs(y(d.open) - y(d.close)));
  
    // Wick (high to low)
    candleGroup
      .append("line")
      .attr("x1", cx)
      .attr("x2", cx)
      .attr("y1", y(d.open))
      .attr("y2", y(d.open))
      .attr("stroke", candleColor)
      .attr("stroke-width", 1)
      .transition()
      .duration(200)
      .attr("y1", y(d.high))
      .attr("y2", y(d.low));
}
  
function hideCandlestick(cx, cy) {
    candleGroup.selectAll("rect")
      .transition()
      .duration(200)
      .attr("y", cy)
      .attr("height", 0)
      .remove();
  
    candleGroup.selectAll("line")
      .transition()
      .duration(200)
      .attr("y1", cy)
      .attr("y2", cy)
      .remove();
}
  

function showTooltip(d, x, yPos) {
    tooltip.transition().duration(200).style("opacity", 0.9);
    tooltip.html(`
      <strong>Date:</strong> ${d3.timeFormat("%b %d, %Y")(d.date)}<br/>
      <strong>Open:</strong> $${d.open}<br/>
      <strong>High:</strong> $${d.high}<br/>
      <strong>Low:</strong> $${d.low}<br/>
      <strong>Close:</strong> $${d.close}<br/>
      <strong>Volume:</strong> ${d.volume.toLocaleString()}
    `)
    .style("left", `${x + 10}px`)
    .style("top", `${yPos}px`);
}
  
function hideTooltip() {
    tooltip.transition().duration(100).style("opacity", 0);
}
  


function addAnnotations(currentData) {

    g.selectAll(".annotations").remove();

    if (!annotationsVisible) return;

    const visibleDates = new Set(currentData.map(d => d.date.toISOString())); // set that contains all dates in currentData

    const parsedAnnotations = annotationData
        .filter(d => visibleDates.has(parseDate(d.date).toISOString()))
    .map((d, i) => {
      const match = currentData.find(cd => parseDate(d.date).toISOString() === cd.date.toISOString());
      return {
        note: {
          title: d.title,
          label: d.label,
          wrap: 180
        },
        data: {
          date: parseDate(d.date),
          open: match?.open || 0 // fallback if missing
        },
        dx: determinedx(i),
        dy: determinedy(i),
        type: d3.annotationCalloutElbow,
        connector: { end: "arrow" }
      };
    });

    const annotations = d3.annotation()
        .type(d3.annotationLabel)
        .accessors({
        x: d => x(d.date),
        y: d => y(d.open)
        })
        .accessorsInverse({
        date: d => x.invert(d.x),
        yValue: d => y.invert(d.y)
        })
        .annotations(parsedAnnotations);


    const annotationGroup = g.append("g")
    .attr("class", "annotations")
    .call(annotations);
    
    // Now select the rendered annotation note groups
    annotationGroup.selectAll(".annotation")
      .attr("data-date", function() {
        const datum = d3.select(this).datum();
        return datum?.data?.date?.toISOString?.() || null;
      })
      .style("opacity", 100);
    
    d3.selectAll(".annotation .annotation-note-title")
        .style("fill", "black");

    d3.selectAll(".annotation .annotation-note-label")
        .style("fill", "black");


}

function determinedx(i) {
    if (i == 4) {
        return 0;
    }
    if (i >= 5) {
        return -30;
    }
    return 30;
}

function determinedy(i) {
    return -60 - (i % 2) * 200
}

function toggleAnnotations() {
    annotationsVisible = !annotationsVisible;
  
    d3.selectAll(".annotations")
      .transition()
      .duration(300)
      .style("opacity", annotationsVisible ? 1 : 0);
  
    // Optionally update the button label
    document.getElementById("toggle-annotations-btn").textContent =
      annotationsVisible ? "Hide Annotations" : "Show Annotations";
}
  
  
  
  // Event Listeners
document.getElementById("play").addEventListener("click", () => {
    if (i >= fullData.length) return;
    isPaused = false;
    cancelAnimationFrame(animationFrame);
    animate();
});
  
document.getElementById("pause").addEventListener("click", () => {
    isPaused = true;
    cancelAnimationFrame(animationFrame);
});
  
document.getElementById("skip").addEventListener("click", () => {
    isPaused = true;
    cancelAnimationFrame(animationFrame);
    i = fullData.length;
    updateChart(fullData);
});

document.getElementById("reset").addEventListener("click", () => {
    isPaused = true;
    cancelAnimationFrame(animationFrame);
    i = 0;
    updateChart([]);
});

document.getElementById("volume").addEventListener("click", () => {
    showVolume = !showVolume;

    if (showVolume) {
        volumeAxisGroup.style("display", "block");
        volumePath.style("display", "block");
        volumeAreaPath.style("display", "block");
    } else {
        volumeAxisGroup.style("display", "none");
        volumePath.style("display", "none");
        volumeAreaPath.style("display", "none");
    }

    updateChart(visibleData, false);
});

document.getElementById("reset-zoom").addEventListener("click", () => {
    currentXDomain = [...fullXDomain];
  
    const currentData = fullData.filter(d => 
      d.date >= currentXDomain[0] && d.date <= currentXDomain[1]
    );
  
    updateChart(currentData, true);
});

document.getElementById("toggle-annotations-btn")
  .addEventListener("click", toggleAnnotations);

  
  