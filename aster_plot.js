looker.plugins.visualizations.add({
  options: {
    legend: {
      type: "string",
      label: "Legend",
      values: [
        { "Left": "left" },
        { "Right": "right" },
        { "Off": "off"}
      ],
      display: "radio",
      default: "off"
    },
    color_range: {
      type: "array",
      label: "Color Range",
      display: "colors"
    },
    font_size: {
      type: "number",
      label: "Font Size",
      display: "range",
      min: 10,
      max: 100,
      default: 40
    },
    radius: {
      type: "number",
      label: "Circle Radius",
      placeholder: 100,
      default: 100
    },
    keyword_search: {
      type: "string",
      label: "Enter custom keyword to search for",
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

    .legend rect {
      fill:white;
      stroke:black;
      opacity:0.8;
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
    this.container.innerHTML = '' // clear container of previous vis
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
        return (radius - innerRadius) * (d.data.score / (1.0*config.radius)) + innerRadius;
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

    if (!config.color_range) {
      config.color_range = ["#62bad4", "#a9c574", "#929292", "#9fdee0", "#1f3e5a", "#90c8ae", "#92818d", "#c5c6a6", "#82c2ca", "#cee0a0", "#928fb4", "#9fc190"];
    }

    var color_length = config.color_range.length;
    for (let i = 0; i < data.length; i++) {
      if (i >= color_length) {
        let j = Math.floor(i/color_length)
        data[i].color = config.color_range[i-(j*color_length)]; // loop through color array if there are too many series
      } else {
        data[i].color = config.color_range[i];
      }
      data[i].label = data[i][dimension].value; // dimension label
      data[i].score = +data[i][measure1].value; // length of slice (circle radius default is 100)
      data[i].weight = +data[i][measure2].value; // angle of slice (width of slice)
      data[i].width = +data[i][measure2].value; // angle of slice (width of slice)      
    }

    // calculate the weighted mean score (value in centre of pie)
    if (!config.keyword_search) {
      var score =
        data.reduce(function(a, b) {
          console.log('Default weighted mean score')
          //console.log('a:' + a + ', b.score: ' + b.score + ', b.weight: ' + b.weight);
          return a + (b.score * b.weight);
        }, 0) /
        data.reduce(function(a, b) {
          return a + b.weight;
        }, 0);
    } else {
      // custom keyword option
      for (let i = 0; i < data.length; i++) {
        if (data[i].label.toLowerCase().includes(config.keyword_search.toLowerCase())) {
          console.log(data[i].label + ' is used for centre score');
          var score = data[i].score;
          data.splice(i,1)
          break;
        }
      }
    }

    // affix score to centre of pie
    svg.append("svg:text")
      .attr("class", "aster-score")
      .attr("dy", ".35em")
      .attr("text-anchor", "middle") // text-align: right
      .attr("font-size", config.font_size)
      .text(Math.round(score));


    var path = svg.selectAll(".solidArc")
      .data(pie(data))
      .enter().append("path")
      .attr("data-legend",function(d) { return d.data.label}) // legend
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

    // legend
    if (config.legend == "left") {
      var legend = svg.append("g")
        .attr("class","legend")
        .attr("transform","translate(-" + width/2.2 + " ,-" + height/2.5 + ")")
        .style("font-size","12px")
        .call(d3legend)
    } else if (config.legend == "right") {
      var legend = svg.append("g")
        .attr("class","legend")
        .attr("transform","translate(" + width/3.0 + " ,-" + height/2.5 + ")")
        .style("font-size","12px")
        .call(d3legend)
    }


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
      var _a = res.fields, pivots = _a.pivots, dimensions = _a.dimension_like, measures = _a.measure_like;
      return (check('pivot-req', 'Pivot', pivots.length, options.min_pivots, options.max_pivots)
          && check('dim-req', 'Dimension', dimensions.length, options.min_dimensions, options.max_dimensions)
          && check('mes-req', 'Measure', measures.length, options.min_measures, options.max_measures));
    }


    // Legend
    // (C) 2012 ziggy.jonsson.nyc@gmail.com
    // MIT licence
    function d3legend(g) {
      g.each(function() {
        var g= d3.select(this),
            items = {},
            svg = d3.select(g.property("nearestViewportElement")),
            legendPadding = g.attr("data-style-padding") || 5,
            lb = g.selectAll(".legend-box").data([true]),
            li = g.selectAll(".legend-items").data([true])

        lb.enter().append("rect").classed("legend-box",true)
        li.enter().append("g").classed("legend-items",true)

        svg.selectAll("[data-legend]").each(function() {
            var self = d3.select(this)
            items[self.attr("data-legend")] = {
              pos : self.attr("data-legend-pos") || this.getBBox().y,
              color : self.attr("data-legend-color") != undefined ? self.attr("data-legend-color") : self.style("fill") != 'none' ? self.style("fill") : self.style("stroke") 
            }
          })

        items = d3.entries(items).sort(function(a,b) { return a.value.pos-b.value.pos})
        
        li.selectAll("text")
            .data(items,function(d) { return d.key})
            .call(function(d) { d.enter().append("text")})
            .call(function(d) { d.exit().remove()})
            .attr("y",function(d,i) { return i+"em"})
            .attr("x","1em")
            .text(function(d) { ;return d.key})
        
        li.selectAll("circle")
            .data(items,function(d) { return d.key})
            .call(function(d) { d.enter().append("circle")})
            .call(function(d) { d.exit().remove()})
            .attr("cy",function(d,i) { return i-0.25+"em"})
            .attr("cx",0)
            .attr("r","0.4em")
            .style("fill",function(d) { 
              // console.log(d.value.color);
              return d.value.color
            })  
        
        // Reposition and resize the box
        var lbbox = li[0][0].getBBox()  
        lb.attr("x",(lbbox.x-legendPadding))
            .attr("y",(lbbox.y-legendPadding))
            .attr("height",(lbbox.height+2*legendPadding))
            .attr("width",(lbbox.width+2*legendPadding))
      })
      return g
    }


    done()
  }
});