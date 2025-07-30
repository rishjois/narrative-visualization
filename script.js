async function init() {
    d3.csv("https://raw.githubusercontent.com/rishjois/narrative-visualization/refs/heads/main/nvidia.csv").then(function(data) {
        console.log("data: " + data[0]);

        data.forEach(row => {
            console.log(`Name: ${row.Date}, Age: ${row.Open}, City: ${row.Close}`);
          });
    });
};


