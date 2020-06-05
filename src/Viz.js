/* eslint-disable react/prop-types */
import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import _ from "lodash";

function buildScaledNodeColourFn(dataFn, parentFn, defaultColour, colourScale) {
  return d => {
    const value = d.children ? parentFn(d) : dataFn(d);

    return value === undefined ? defaultColour : colourScale(value);
  };
}

// This is for config that _could_ go in the state, if it needs to change,
// but for now it is actually not changing and simpler to put it here.
const constantConfig = {
  goodBadScale: d3
    .scaleSequential(c => d3.interpolateRdYlGn(1.0 - c))
    .clamp(true),
  lowHighScale: d3.scaleSequential(d3.interpolateMagma).clamp(true),
  neutralColour: d3.rgb("green")
};

// use getIn for objects as well as immutable objects
function nestedGet(object, path) {
  // re-enable this if using immutable.js
  // if (Immutable.isImmutable(object)) {
  // return Immutable.getIn(object, path);
  // }
  let index = 0;
  const { length } = path;
  let o = object;

  while (o != null && index < length) {
    // eslint-disable-next-line no-plusplus
    o = o[path[index++]];
  }
  return index && index === length ? o : undefined;
}

function locDataFn(d) {
  return d.data.value;
}
function depthDataFn(d) {
  return d.depth;
}

function buildLocFillFn() {
  const neutralColour = d3.rgb("green");
  const maxLoc = 1000;
  const colourScale = c => d3.interpolateRdYlGn(1.0 - c); // see https://github.com/d3/d3-scale-chromatic/blob/master/README.md
  // const goodestColour = colourScale(0);
  // const baddestColour = colourScale(1);
  const goodBadScale = d3.scaleSequential(colourScale).clamp(true);

  return buildScaledNodeColourFn(
    locDataFn,
    locDataFn,
    neutralColour,
    goodBadScale.copy().domain([0, maxLoc])
  );
}

function buildDepthFn() {
  const neutralColour = d3.rgb("green");
  const maxDepth = 10;
  const colourScale = c => d3.interpolateRdYlGn(1.0 - c); // see https://github.com/d3/d3-scale-chromatic/blob/master/README.md
  // const goodestColour = colourScale(0);
  // const baddestColour = colourScale(1);
  const goodBadScale = d3.scaleSequential(colourScale).clamp(true);

  return buildScaledNodeColourFn(
    depthDataFn,
    depthDataFn,
    neutralColour,
    goodBadScale.copy().domain([0, maxDepth])
  );
}

function indentationNodeFn(config) {
  return (d) => {
    return _.get(d, ['data','data','indentation', config.indentation.metric], undefined);
  };
}

function indentationParentFn(config) {
  return (d) => undefined;
}

function buildFillFunctions(config, stats) {
  return {
    loc: buildScaledNodeColourFn(
      locDataFn,
      () => undefined,
      constantConfig.neutralColour,
      constantConfig.goodBadScale.copy().domain([0, stats.maxLoc])
    ),
    depth: buildScaledNodeColourFn(
      depthDataFn,
      depthDataFn,
      constantConfig.neutralColour,
      constantConfig.lowHighScale.copy().domain([0, stats.maxDepth])
    ),
    indentation: buildScaledNodeColourFn(
        indentationNodeFn(config),
        indentationParentFn(config),
        constantConfig.neutralColour,
      constantConfig.goodBadScale
        .copy()
        .domain([0, config.indentation.maxIndentationScale])
    )
  };
}

const redrawPolygons = (svgSelection, data, state) => {
  const { config, stats } = state;

  console.log("refreshing");

  const fillFunctions = buildFillFunctions(config, stats);

  // const locFillFn = buildLocFillFn();
  // const depthFillFn = buildDepthFn();

  const fillFn = fillFunctions[config.visualization];
  const strokeFn = d => {
    return d.depth < 5 ? 5 - d.depth : 1;
  };

  return svgSelection
    .attr("d", d => {
      return `${d3.line()(d.data.layout.polygon)}z`;
    })
    .style("fill", fillFn)
    .style("stroke-width", strokeFn)
    .style("vector-effect", "non-scaling-stroke"); // so zooming doesn't make thick lines
};

const update = (d3Container, data, state) => {
  if (!d3Container.current) {
    throw Error("No current container");
  }
  const vizEl = d3Container.current;
  const svg = d3.select(vizEl);
  redrawPolygons(svg.selectAll(".cell"), data, state);
};

const draw = (d3Container, data, state, dispatch) => {
  const { config, expensiveConfig } = state;

  if (!d3Container.current) {
    console.log("in draw but d3container not yet current");
    return;
  }
  const vizEl = d3Container.current;
  // console.log(vizEl);
  const w = vizEl.clientWidth;
  const h = vizEl.clientHeight;
  const svg = d3.select(vizEl).attr("viewBox", [0, 0, w, h]);
  const group = svg.selectAll(".topGroup");
  const rootNode = d3.hierarchy(data.current); // .sum(d => d.value);

  console.log("drawing");

  const allNodes = rootNode
    .descendants()
    .filter(d => d.depth <= expensiveConfig.depth);

  const nodes = group
    .datum(rootNode)
    .selectAll(".cell")
    .data(allNodes, node => node.path);

  const newNodes = nodes
    .enter()
    .append("path")
    .classed("cell", true);

  redrawPolygons(nodes.merge(newNodes), data, state)
    .on("click", (node, i, nodeList) => {
      console.log("onClicked", node, i, nodeList[i]);
      dispatch({ type: "selectNode", payload: node.data });
    })
    .append("svg:title")
    .text(n => n.data.path);

  nodes.exit().remove();

  // zooming - see https://observablehq.com/@d3/zoomable-map-tiles?collection=@d3/d3-zoom
  const zoomed = () => {
    group.attr("transform", d3.event.transform);
  };

  svg.call(
    d3
      .zoom()
      .extent([
        [0, 0],
        [w, h]
      ])
      .scaleExtent([0.5, 8])
      .on("zoom", zoomed)
  );
};

// see https://stackoverflow.com/questions/53446020/how-to-compare-oldvalues-and-newvalues-on-react-hooks-useeffect
function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

const Viz = props => {
  const d3Container = useRef(null);
  const {
    data,
    state,
    dispatch,
    state: { config, expensiveConfig }
  } = props;

  const prevState = usePrevious({ data, config, expensiveConfig });

  console.log("creating Viz");

  useEffect(() => {
    if (
      prevState === undefined ||
      prevState.expensiveConfig !== expensiveConfig
    ) {
      console.log("expensive config change - rebuild all");
      draw(d3Container, data, state, dispatch);
    } else if (prevState.config !== config) {
      console.log("cheap config change - just redraw");
      update(d3Container, data, state);
    } else {
      console.log("no change in visible config - not doing nothing");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, state]);

  return (
    <aside className="Viz">
      <svg ref={d3Container}>
        <g className="topGroup" />
      </svg>
    </aside>
  );
};

export default Viz;
