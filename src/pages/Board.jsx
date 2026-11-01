import { useState, useRef } from "react";

export default function Board() {
  const [selected, setSelected] = useState(null);

  const [shapes, setShapes] = useState([
    { id: 1, type: "rect", x: 100, y: 100, width: 200, height: 100 },
    { id: 2, type: "circle", x: 100, y: 100, radius: 60 },
    { id: 3, type: "line", x1: 700, y1: 100, x2: 900, y2: 300 },
  ]);

  return (
    <svg viewBox="0 0 1600 900">
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
            ></rect>
          );
        } else if (s.type === "circle") {
          return (
            <circle
              key={s.id}
              cx={s.x}
              onClick={() => setSelected(s.id)}
              stroke={selected === s.id ? "orange" : "black"}
              cy={s.y}
              r={s.radius}
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
            ></line>
          );
        } else {
          return null;
        }
      })}
    </svg>
  );
}
