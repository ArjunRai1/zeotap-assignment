import React, { useState, useEffect, useMemo } from "react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import Toolbar from "./Toolbar";
import "./Sheet.css";

const initialRows = 10;
const initialCols = 10;

const Sheet = () => {
  // Column Naming (A, B, C... AA, AB...)
  const generateColumnName = (index) => {
    let name = "";
    while (index >= 0) {
      name = String.fromCharCode((index % 26) + 65) + name;
      index = Math.floor(index / 26) - 1;
    }
    return name;
  };

  // Load Data from LocalStorage
  const loadData = () => {
    const storedData = JSON.parse(localStorage.getItem("spreadsheetData"));
    return storedData || Array.from({ length: initialRows }, (_, i) => {
      let row = { id: i + 1 };
      Array.from({ length: initialCols }, (_, j) => (row[`col${j}`] = ""));
      return row;
    });
  };

  const [data, setData] = useState(loadData());
  const [rowCount, setRowCount] = useState(data.length);
  const [colCount, setColCount] = useState(data[0] ? Object.keys(data[0]).length - 1 : initialCols);
  const [selectedCell, setSelectedCell] = useState(null);
  const [cellStyles, setCellStyles] = useState(JSON.parse(localStorage.getItem("cellStyles")) || {});

  // Save Data to LocalStorage
  useEffect(() => {
    localStorage.setItem("spreadsheetData", JSON.stringify(data));
    localStorage.setItem("cellStyles", JSON.stringify(cellStyles));
  }, [data, cellStyles]);

  // Generate Columns Dynamically
  const columns = useMemo(() =>
    Array.from({ length: colCount }, (_, i) => ({
      accessorKey: `col${i}`,
      header: generateColumnName(i),
      cell: ({ getValue, row, column }) => (
        <input
          type="text"
          value={getValue() || ""}
          onChange={(e) => handleCellChange(row.index, column.id, e.target.value)}
          onFocus={() => setSelectedCell(`${row.index}-${column.id}`)}
          style={cellStyles[`${row.index}-${column.id}`] || {}}
        />
      )
    })), [colCount, cellStyles]);

  // Handle Cell Changes
  const handleCellChange = (rowIndex, columnId, value) => {
    setData((prevData) =>
      prevData.map((row, i) =>
        i === rowIndex ? { ...row, [columnId]: value } : row
      )
    );
  };

  // Handle Format Changes
  const handleFormatChange = (format, value) => {
    if (!selectedCell) return;
    setCellStyles((prev) => ({
      ...prev,
      [selectedCell]: { ...prev[selectedCell], [format]: value || (prev[selectedCell]?.[format] ? "" : format) }
    }));
  };

  // Handle Color Changes
  const handleColorChange = (type, color) => {
    if (!selectedCell) return;
    setCellStyles((prev) => ({
      ...prev,
      [selectedCell]: { ...prev[selectedCell], [type]: color }
    }));
  };

  // Handle Adding & Deleting Rows/Columns at Selected Position
  const modifyGrid = (action) => {
    if (!selectedCell) return;
    
    const [selectedRow, selectedCol] = selectedCell.split("-").map(Number);

    if (action === "addColumn") {
      setColCount((prev) => prev + 1);
      setData((prevData) =>
        prevData.map((row) => {
          const newRow = { ...row };
          Object.keys(row).forEach((key, index) => {
            if (index === selectedCol + 1) {
              newRow[`col${colCount}`] = "";
            }
          });
          return newRow;
        })
      );
    }

    if (action === "deleteColumn" && colCount > 1) {
      setColCount((prev) => prev - 1);
      setData((prevData) =>
        prevData.map((row) => {
          const newRow = { ...row };
          delete newRow[`col${selectedCol}`];
          return newRow;
        })
      );
    }

    if (action === "addRow") {
      const newRow = { id: rowCount + 1 };
      columns.forEach((col) => (newRow[col.accessorKey] = ""));
      setData((prevData) => [...prevData.slice(0, selectedRow + 1), newRow, ...prevData.slice(selectedRow + 1)]);
      setRowCount((prev) => prev + 1);
    }

    if (action === "deleteRow" && rowCount > 1) {
      setData((prevData) => prevData.filter((_, index) => index !== selectedRow));
      setRowCount((prev) => prev - 1);
    }
  };

  // Create Table Instance
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  return (
    <div>
      <Toolbar onFormatChange={handleFormatChange} onColorChange={handleColorChange} onModifyGrid={modifyGrid} />
      <div className="table-wrapper">
        <div className="table-container">
          <table>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Sheet;
