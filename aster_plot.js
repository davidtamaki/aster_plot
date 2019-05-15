looker.plugins.visualizations.add({
  options: {
    font_size: {
      type: "string",
      label: "Font Size",
      values: [{
          "Large": "large"
        },
        {
          "Small": "small"
        }
      ],
      display: "radio",
      default: "large"
    }
  },

  // Set up the initial state of the visualization
  create: function(element, config) {

    var css = `
      <style> 
        body {
      font: 10px sans-serif;
    }

    .axis path,
    .axis line {
      fill: none;
      stroke: #000;
      shape-rendering: crispEdges;
    }

    .bar {
      fill: orange;
    }

    .solidArc:hover {
      fill: orangered ;
    }

    .solidArc {
        -moz-transition: all 0.3s;
        -o-transition: all 0.3s;
        -webkit-transition: all 0.3s;
        transition: all 0.3s;
    }

    .x.axis path {
      display: none;
    }

    .aster-score { 
      line-height: 1;
      font-weight: bold;
      font-size: 500%;
    }

    .d3-tip {
      line-height: 1;
      font-weight: bold;
      padding: 12px;
      background: rgba(0, 0, 0, 0.8);
      color: #fff;
      border-radius: 2px;
    }

    /* Creates a small triangle extender for the tooltip */
    .d3-tip:after {
      box-sizing: border-box;
      display: inline;
      font-size: 10px;
      width: 100%;
      line-height: 1;
      color: rgba(0, 0, 0, 0.8);
      content: "\\25BC";
      position: absolute;
      text-align: center;
    }

    /* Style northward tooltips differently */
    .d3-tip.n:after {
      margin: -1px 0 0 0;
      top: 100%;
      left: 0;
    }
      </style> `;

    element.innerHTML = css;
    var container = element.appendChild(document.createElement("div")); // Create a container element to let us center the text.
    this.container = container
    container.className = "d3-aster-plot";
    this._textElement = container.appendChild(document.createElement("div")); // Create an element to contain the text.
  },


  // Render in response to the data or settings changing
  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.container.innerHTML = '' // clear container of previous vis so width & height is correct
    this.clearErrors(); // clear any errors from previous updates

    // Throw some errors and exit if the shape of the data isn't what this chart needs
    if (queryResponse.fields.dimensions.length == 0) {
      this.addError({
        title: "No Dimensions",
        message: "This chart requires dimensions."
      });
      return;
    }

    var width = 500,
      height = 500,
      radius = Math.min(width, height) / 2,
      innerRadius = 0.3 * radius;

    var pie = d3.layout.pie()
      .sort(null)
      .value(function(d) {
        return d.width;
      });

    var tip = d3.tip()
      .attr('class', 'd3-tip')
      .offset([0, 0])
      .html(function(d) {
        return d.data.label + ": <span style='color:orangered'>" + d.data.score + "</span>";
      });

    var arc = d3.svg.arc()
      .innerRadius(innerRadius)
      .outerRadius(function(d) {
        return (radius - innerRadius) * (d.data.score / 100.0) + innerRadius;
      });

    var outlineArc = d3.svg.arc()
      .innerRadius(innerRadius)
      .outerRadius(radius);

    var svg = d3.select(".d3-aster-plot").append("svg")
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

    svg.call(tip);


    data.forEach(function(d) {
      console.log(d)
      d.id = d['aster_plot_custom_vis.id'].value;
      // d.order = +d.order;
      d.color = d['aster_plot_custom_vis.color'].value;
      d.weight = +d['aster_plot_custom_vis.weight'].value;
      d.score = +d['aster_plot_custom_vis.score'].value;
      d.width = +d['aster_plot_custom_vis.weight'].value;
      d.label = d['aster_plot_custom_vis.label'].value;
    });


    var path = svg.selectAll(".solidArc")
      .data(pie(data))
      .enter().append("path")
      .attr("fill", function(d) {
        return d.data.color;
      })
      .attr("class", "solidArc")
      .attr("stroke", "gray")
      .attr("d", arc)
      .on('mouseover', tip.show)
      .on('mouseout', tip.hide);

    var outerPath = svg.selectAll(".outlineArc")
      .data(pie(data))
      .enter().append("path")
      .attr("fill", "none")
      .attr("stroke", "gray")
      .attr("class", "outlineArc")
      .attr("d", outlineArc);


    // calculate the weighted mean score
    var score =
      data.reduce(function(a, b) {
        //console.log('a:' + a + ', b.score: ' + b.score + ', b.weight: ' + b.weight);
        return a + (b.score * b.weight);
      }, 0) /
      data.reduce(function(a, b) {
        return a + b.weight;
      }, 0);

    svg.append("svg:text")
      .attr("class", "aster-score")
      .attr("dy", ".35em")
      .attr("text-anchor", "middle") // text-align: right
      .text(Math.round(score));




    done()
  }
});