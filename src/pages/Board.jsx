import { useState, useRef } from "react";

export default function Board() {
  const [selected, setSelected] = useState(null);
  const svgRef = useRef(null);

  function getPoint(e) {
    const box = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * 1600;
    const y = ((e.clientY - box.top) / box.height) * 900;

    return { x, y };
  }

  const [shapes, setShapes] = useState([
    { id: 1, type: "rect", x: 100, y: 100, width: 200, height: 100 },
    { id: 2, type: "circle", x: 500, y: 300, radius: 60 },
    { id: 3, type: "line", x1: 700, y1: 100, x2: 900, y2: 300 },
  ]);

  function editShape(id, x, y) {
    setShapes = shapes.map((s) => {
      if (s.id === id) {
        return { ...s, x, y };
      }
      return s;
    });
  }

  return (
    <svg
      viewBox="0 0 1600 900"
      style={{ width: "100%", border: "1px solid black" }}
      ref={svgRef}
      onClick={(e) => console.log(getPoint(e))}
    >
      <rect
        width={1600}
        height={900}
        fill="white"
        onClick={() => setSelected(null)}
      />
      {shapes.map((s) => {
        if (s.type === "rect") {
          return (
            <rect
              key={s.id}
              x={s.x}
              y={s.y}
              width={s.width}
              height={s.height}
              onClick={() => setSelected(s.id)}
              stroke={selected === s.id ? "orange" : "black"}
              strokeWidth={3}
            ></rect>
          );
        } else if (s.type === "circle") {
          return (
            <circle
              key={s.id}
              cx={s.x}
              cy={s.y}
              r={s.radius}
              onClick={() => setSelected(s.id)}
              stroke={selected === s.id ? "orange" : "black"}
              strokeWidth={3}
            ></circle>
          );
        } else if (s.type === "line") {
          return (
            <line
              key={s.id}
              x1={s.x1}
              y1={s.y1}
              x2={s.x2}
              y2={s.y2}
              onClick={() => setSelected(s.id)}
              stroke={selected === s.id ? "orange" : "black"}
              strokeWidth={3}
            />
          );
        } else {
          return null;
        }
      })}
    </svg>
  );
}
