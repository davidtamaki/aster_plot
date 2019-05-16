looker.plugins.visualizations.add({
  options: {
    font_size: {
      type: "string",
      label: "Font Size",
      values: [
       { "Large": "large" },
        { "Small": "small" }
      ],
      display: "radio",
      default: "large"
    },
    color: {
      type: 'string',
      label: 'Custom Color',
      display: 'color',
    },
    diameter: {
      type: "string",
      label: "Diameter",
      default: '100%',
      placeholder: "100%"
    },
    keyword_search: {
      type: "string",
      label: "Enter Keyword to search for",
      placeholder: "Power"
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

    // ensure data fit - requires no pivots, exactly 1 dimension_like field, and exactly 2 measure_like fields
    if (!handleErrors(this, queryResponse, { 
      min_pivots: 0, max_pivots: 0, 
      min_dimensions: 1, max_dimensions: 1, 
      min_measures: 2, max_measures: 2})) {
      return;
    } 

    var dimension = queryResponse.fields.dimension_like[0].name;
    var measure1 = queryResponse.fields.measure_like[0].name, measure2 = queryResponse.fields.measure_like[1].name;
    
    console.log(data)

    var width = element.clientWidth,
      height = element.clientHeight,
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
      // console.log(d)
      // d.id = d['aster_plot_custom_vis.id'].value;
      // d.order = +d.order;
      d.label = d[dimension].value;
      d.color = d['aster_plot_custom_vis.color'].value; // handle in vis config tab
      d.score = +d[measure1].value; // length of slice (circle is 100)
      d.weight = +d[measure2].value; // angle of slice (width of slice)
      d.width = +d[measure2].value; // angle of slice (width of slice)
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


    // Helper functions
    function handleErrors(vis, res, options) {
      var check = function (group, noun, count, min, max) {
          if (!vis.addError || !vis.clearErrors) {
              return false;
          }
          if (count < min) {
              vis.addError({
                  title: "Not Enough " + noun + "s",
                  message: "This visualization requires " + (min === max ? 'exactly' : 'at least') + " " + min + " " + noun.toLowerCase() + (min === 1 ? '' : 's') + ".",
                  group: group
              });
              return false;
          }
          if (count > max) {
              vis.addError({
                  title: "Too Many " + noun + "s",
                  message: "This visualization requires " + (min === max ? 'exactly' : 'no more than') + " " + max + " " + noun.toLowerCase() + (min === 1 ? '' : 's') + ".",
                  group: group
              });
              return false;
          }
          vis.clearErrors(group);
          return true;
      };
      var _a = res.fields, pivots = _a.pivots, dimensions = _a.dimensions, measures = _a.measure_like;
      return (check('pivot-req', 'Pivot', pivots.length, options.min_pivots, options.max_pivots)
          && check('dim-req', 'Dimension', dimensions.length, options.min_dimensions, options.max_dimensions)
          && check('mes-req', 'Measure', measures.length, options.min_measures, options.max_measures));
    }

    done()
  }
});