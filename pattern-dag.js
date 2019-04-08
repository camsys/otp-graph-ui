var otpApi = window.OTP_config ? window.OTP_config.otpApi : "http://localhost:8080/otp/routers/";

document.addEventListener("DOMContentLoaded", function(event) { 

  flatpickr(d3.select("#mydatetime").node(), {
    enableTime: true,
    dateFormat: "Y-m-d h:iK",
  });

  d3.select("#submit").on("click", function() {
    var datetime = d3.select("#mydatetime").node().value;
    var route = d3.select("#route").node().value;
    var direction = d3.select('input[name=direction]:checked').node().value;
    var date = null, time = null;
    if (datetime) {
      var date = datetime.split(" ")[0]
      var time = datetime.split(" ")[1]
    }
    update(route, direction, date, time);
  })
})

function update(route, direction, date, time) {
  // based on https://jsfiddle.net/ye2xanf9/77/
  var url = otpApi  + "default/patternGraph?routeIds=" + route + "&directionId=" + direction;
  if (date != null && time != null) {
      url += "&date=" + date + "&time=" + time;
  }
  if (window.OTP_config && window.OTP_config.otpApiKey) {
     url += "&apikey=" + window.OTP_config.otpApiKey
  } 

  d3.json(url).then((data) => {

    /////////////////////////
    // Start error checking 
    ////////////////////////
    if(data.nodes.length == 0){
      alert("No stops available for the selected routes.");
    }

    try{
    d3.dratify()
     .id(d => d.id)
     .parentIds(d => d.successors.map(function(x) { return x.id }))
     (data.nodes)
    }catch(err){
      alert("These routes do not intersect.");
    }
    // End Error Checking

    var successorsArray  = [];
    var routeTypeMap  = buildRouteTypeMap(data);

    const dag = d3.dratify()
     .id(d => d.id)
     .parentIds(d => d.successors.map(function(x) { return x.id }))
     (data.nodes)
     .reverse()

    d3.sugiyama()(dag);

    const links = dag.links()
    const descendants = dag.descendants();

    //Figure out the height of the graph.
    var height;
    if (dag.height().value === undefined){
      //This means we have a DAG with multiple roots. Find the height of the tallest root.
      var maxHeight = 0;
      for(var i = 0; i < dag.children.length; i++){
        if(dag.children[i].height().value > maxHeight){
          maxHeight = dag.children[i].height().value;
        }
      }
      height = maxHeight * 50;
    }else{ //This DAG has only one root
      height = dag.height().value * 50;
    }

    const width = 800;
    

    d3.selectAll("svg").remove();
    
    const svgSelection = d3.select('#stops')
      .append('svg')
      .attr('height', height + 200)
      .attr('width', width + 400)
      .attr('margin', '20')
    
    const line = d3.line()
      .curve(d3.curveCatmullRom)
      .x(d => d.x * width)
      .y(d => d.y * height);

    const g = svgSelection.append('g').attr('transform', `translate(${200},${100})`)

    g.append('g')
      .selectAll('path')
      .data(links)
      .enter()
      .append('path')
      .attr('d', ({
          source,
          target,
          data
        }) =>
        line([{
          x: source.x,
          y: source.y
        }].concat(
          data.points || [], [{
            x: target.x,
            y: target.y
          }])))
      .attr('interpolate', 'linear')
      .attr('fill', 'none')
      .attr('stroke', 'black')
      .style("stroke-dasharray", ("3", d => dash(d))) 
      .attr('stroke-width', 1)


    const nodes = g.append('g')
      .selectAll('g')
      .data(descendants)
      .enter()
      .append('g')
      .attr('transform', ({
        x,
        y
      }) => `translate(${x*width}, ${y*height})`);


    //Create one gradient for each stop. TODO: We really only need to do this for stops with > 1 color.
    var colorTypes = [];
    descendants.forEach(function(e){
      colorTypes.push({"color1": e.data.attribute.color[0], "color2": e.data.attribute.color[1], "name":"grad"+e.id})
    });
    var grad = g.append("defs")
      .selectAll("linearGradient").data(colorTypes).enter()
     .append("linearGradient").attr("id", d => d.name).attr("x1", "0%").attr("x2", "0%").attr("y1", "100%").attr("y2", "0%");
    grad.append("stop").attr("offset", "50%").style("stop-color", d => d.color1);
    grad.append("stop").attr("offset", "50%").style("stop-color", d => d.color2);


    nodes.append('circle').filter(function(d) { return isShuttle(d) })
      .attr('width', 30) 
      .attr('height', 30)
      .attr('x',-15)
      .attr('y',-15)
      .attr('r',15)
      .attr('stroke', "black")
      .attr("stroke-width", d => boldIfTerminal(d))
      .attr('fill', function(d, i) {
        if(d.data.attribute.color.length > 1) //Stops with more than 1 color
          return "url(#grad" + d.id + ")"; 
        else
          return d.data.attribute.color // Stops with 1 Color
      } )
      .attr('transform', 'translate(0, 0)');

    nodes.append('rect').filter(function(d) { return !isShuttle(d) })
      .attr('width', 30) 
      .attr('height', 30)
      .attr('x',-15)
      .attr('y',-15)
      .attr('r',15)
      .attr('stroke', "black")
      .attr("stroke-width", d => boldIfTerminal(d))
      .attr('fill', function(d, i) {
        if(d.data.attribute.color.length > 1) //Stops with more than 1 color
          return "url(#grad" + d.id + ")"; 
        else
          return d.data.attribute.color // Stops with 1 Color
      } )
      .attr('transform', 'translate(0, 0)');

    nodes.append('text').text(d => d.data.attribute.name + ' (' + buildRouteStopString(d.data.attribute.routes) + ')').attr('text-anchor', 'right').attr('alignment-baseline', 'middle').attr("x",30);

    // Determine if the link should be a dashed line (shuttle) or solid line (subway)
    function dash(data){
      routeType = routeTypeMap[data.target.id + 'to' + data.source.id];
      if(routeType == 714)
        return 3
      else 
        return 0
      end
    }

    // Build a map of all the route types between each node
    function buildRouteTypeMap(data){
      map = {}
      data.nodes.forEach(function(entry){
        entry.successors.forEach(function(s){
          map[entry.id + 'to' + s.id] =  s.routeType;
        })
      });
      return map;

    }

    function boldIfTerminal(data){
      if(data.data.attribute.isTerminal == true)
        return 5;
      else
        return 1;
    }

    function isShuttle(data){
      if(data.data.attribute.shuttling == true){
        return false;
      }
      else{
        return true;
      }
    }

    function buildRouteStopString(data){
      return_string = " "
      data.forEach(function(route){
        return_string += route.route + ':' + route.stop + ' '
      });
      return return_string
    }


  });
}
