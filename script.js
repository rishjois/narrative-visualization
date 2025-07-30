async function init() {
    d3.csvParse("nvidia.csv").then(function() {
        console.log("data: " + data);
    });
};
  