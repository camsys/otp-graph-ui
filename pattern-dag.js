
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
  var url = "http://localhost:8080/otp/routers/default/patternGraph?routeId=" + route + "&directionId=" + direction;
  if (date != null && time != null) {
      url += "&date=" + date + "&time=" + time;
  } 
  d3.json(url).then((data) => {

    const dag = d3.dratify()
     .id(d => d.stopId)
     .parentIds(d => d.successors)
     (data.nodes)

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
      height = maxHeight * 80;
    }else{ //This DAG has only one root
      height = dag.height().value * 80;
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
      .attr('fill', 'none')
      .attr('stroke', 'black')

    const nodes = g.append('g')
      .selectAll('g')
      .data(descendants)
      .enter()
      .append('g')
      .attr('transform', ({
        x,
        y
      }) => `translate(${x*width}, ${y*height})`);

    nodes.append('circle')
      .attr('r',15)
      .attr('fill', d => d.data.nodeAttribute.color)
      .attr('stroke', 'black')
      .attr('transform', 'translate(0, 0)');

    // Add text, which screws up measureement
    //nodes.append('text').text(d => d.data.attributes.name + ' ' + d.data.stopId + ' ' + d.data.attributes.cluster).attr('text-anchor', 'middle').attr('alignment-baseline', 'middle');
    nodes.append('text').text(d => d.data.attributes.name).attr('text-anchor', 'right').attr('alignment-baseline', 'middle').attr("x",30);

  });
}