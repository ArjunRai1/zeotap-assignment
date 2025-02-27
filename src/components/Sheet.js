import React, { useState, useMemo } from "react";
import {useReactTable, getCoreRowModel, flexRender} from "@tanstack/react-table";
import "./Sheet.css";

const numRows = 100; 
const numCols = 100; 

const Sheet = () => {
  const generateColumnName = (index) => {
    let name = "";
    while (index >= 0) 
    {
        name = String.fromCharCode((index % 26) + 65) + name;
        index = Math.floor(index / 26) - 1;
    }
    return name;
  };

  const columns = useMemo(() =>
      Array.from({ length: numCols }, (_, i) => ({accessorKey: `col${i}`, header: generateColumnName(i), cell: ({ getValue, row, column }) => (
          <input type="text" value={getValue() || ""} onChange={(e) => handleCellChange(row.index, column.id, e.target.value)} />)
      })),
    []
  );

  const createInitialRows = () =>
    Array.from({ length: numRows }, (_, i) => {let row = { id: i + 1 }; columns.forEach((col) => (row[col.accessorKey] = ""));
      return row;
    });

  const [data, setData] = useState(createInitialRows());

  const handleCellChange = (rowIndex, columnId, value) => {
    setData((prevData) =>
      prevData.map((row, i) =>
        i === rowIndex ? { ...row, [columnId]: value } : row
      )
    );
  };

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  return (
    <div className="table-wrapper">
      <div className="table-container">
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Sheet;
