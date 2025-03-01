import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const GoogleSheetsClone = () => {
  const INITIAL_ROWS = 10;
  const INITIAL_COLS = 10;
  const [rowCount, setRowCount] = useState(INITIAL_ROWS);
  const [colCount, setColCount] = useState(INITIAL_COLS);
  const [colWidths, setColWidths] = useState({});
  const [rowHeights, setRowHeights] = useState({});
  const [resizingCol, setResizingCol] = useState(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const [resizingRow, setResizingRow] = useState(null);
  const [startY, setStartY] = useState(0);
  const [startHeight, setStartHeight] = useState(0);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [dragStartCell, setDragStartCell] = useState(null);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');



  const initializeGrid = (rows, cols) => {
    const newGrid = {};
    for (let i = 0; i<rows; i++) {
      for (let j = 0; j<cols; j++) {
        const cellId = `${i},${j}`;
        newGrid[cellId] = {
          value: '',
          formula: '',
          style: {
            fontWeight: 'normal',
            fontStyle: 'normal',
            fontSize: '14px',
            color: '#000',
            textDecoration: 'none',
            textAlign: 'left'
          },
          dataType: 'text'
        };
      }
    }
    return newGrid;
  };

  const [grid, setGrid] = useState(() => initializeGrid(rowCount, colCount));
  const [activeCell, setActiveCell] = useState(null);
  const [formulaBarValue, setFormulaBarValue] = useState('');
  const [selectedCells, setSelectedCells] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);

  const cellRefs = useRef({});
  const getColLetter = (index) => String.fromCharCode(65 + index);
  const getCellRef = (row, col) => `${getColLetter(col)}${row + 1}`;

  const parseCellRef = (ref) => {
    const cleanRef = ref.replace(/\$/g, '');
    const match = cleanRef.match(/([A-Z]+)(\d+)/);
    if (!match) return null;
    const colLetters = match[1];
    const row = parseInt(match[2], 10) - 1;
    let col = 0;
    for (let i = 0; i < colLetters.length; i++) {
      col = col * 26 + (colLetters.charCodeAt(i) - 64);
    }
    return { row, col: col - 1 };
  };

  const evaluateFormula = (formula, cellId) =>      {
    if (!formula.startsWith('=')) return formula;
    try {
      const expression = formula.substring(1).trim();
      const functionMatch = expression.match(/^([A-Z_]+)\((.*)\)$/i);
      if (functionMatch) {
        const funcName = functionMatch[1].toUpperCase();
        const argsStr = functionMatch[2];
        if (["SUM", "AVERAGE", "MAX", "MIN", "COUNT"].includes(funcName)) 
        {
          let values = [];
          if (argsStr.includes(':')) 
          {
            values = getRangeValues(argsStr);
          } 
          else 
          {
            values = argsStr.split(',').map(arg => parseFloat(resolveArgument(arg)));
          }
          switch (funcName) {
            case "SUM":
              return values.reduce((acc, val) => acc + (isNaN(val) ? 0 : val), 0).toString();
            case "AVERAGE": {
              const nums = values.filter(v => !isNaN(v));
              return (nums.length ? (nums.reduce((acc, v) => acc + v, 0) / nums.length) : 0).toString();
            }
            case "MAX":
              return Math.max(...values.filter(v => !isNaN(v))).toString();
            case "MIN":
              return Math.min(...values.filter(v => !isNaN(v))).toString();
            case "COUNT":
              return values.filter(v => !isNaN(v)).length.toString();
            default:
              return 'ERROR';
          }
        } 
        else if (funcName === "TRIM") 
        {
          return resolveArgument(argsStr).trim();
        } 
        else if (funcName === "UPPER") 
        {
          return resolveArgument(argsStr).toUpperCase();
        } 
        else if(funcName === "LOWER") 
        {
          return resolveArgument(argsStr).toLowerCase();
        } 
        else if(funcName === "REMOVE_DUPLICATES") 
        {
          const rows = getRangeValues2D(argsStr);
          const uniqueRows = removeDuplicates(rows);
          return JSON.stringify(uniqueRows);
        } 
        else if(funcName === "FIND_AND_REPLACE") 
        {
          const parts = argsStr.split(',').map(p => p.trim());
          if (parts.length < 3) 
            return 'Error';
          const searchText = resolveArgument(parts[0]);
          const replaceText = resolveArgument(parts[1]);
          const rangeRows = getRangeValues2D(parts[2]);
          return JSON.stringify(findAndReplace(rangeRows, searchText, replaceText));
        }
      }
      const cellRefPattern = /(\$?[A-Z]+\$?\d+)/g;
      let processedExpression = expression;
      const matches = expression.match(cellRefPattern) || [];
      for (const ref of matches) 
      {
        const coords = parseCellRef(ref);
        if (!coords) 
          continue;
        const id = `${coords.row},${coords.col}`;
        if (id === cellId) 
          return '#CIRCULAR!';
        const cellValue = grid[id]?.value || 0;
        processedExpression = processedExpression.replace(ref, cellValue);
      }
      const result = eval(processedExpression);
      return result.toString();
    } 
    catch (error) 
    {
      return 'Error';
    }
  };

  const resolveArgument = (arg) => {
    const trimmed = arg.trim();
    if (/^\$?[A-Z]+\$?\d+$/.test(trimmed)) 
    {
      const coords = parseCellRef(trimmed);
      if (coords) 
      {
        const id = `${coords.row},${coords.col}`;
        return grid[id]?.value || '';
      }
    }
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) 
    {
      return trimmed.substring(1, trimmed.length - 1);
    }
    return trimmed;
  };

  const getRangeValues = (rangeStr) => {
    const parts = rangeStr.split(':');
    if (parts.length !== 2) 
      return [];
    const start = parseCellRef(parts[0]);
    const end = parseCellRef(parts[1]);
    if (!start || !end) 
      return [];
    let values = [];
    for (let r = start.row; r <= end.row; r++) {
      for (let c = start.col; c <= end.col; c++) 
      {
        const id = `${r},${c}`;
        const val = parseFloat(grid[id]?.value);
        values.push(isNaN(val) ? 0 : val);
      }
    }
    return values;
  };

  const getRangeValues2D = (rangeStr) => {
    const parts = rangeStr.split(':');
    if (parts.length !== 2) 
      return [];
    const start = parseCellRef(parts[0]);
    const end = parseCellRef(parts[1]);
    if (!start || !end) 
      return [];
    let values = [];
    for (let r = start.row; r <= end.row; r++) 
    {
      let rowArr = [];
      for (let c = start.col; c <= end.col; c++) 
      {
        const id = `${r},${c}`;
        rowArr.push(grid[id]?.value);
      }
      values.push(rowArr);
    }
    return values;
  };

  const removeDuplicates = (rows) => {
    const seen = new Set();
    const unique = [];
    rows.forEach(row => {
      const key = JSON.stringify(row);
      if (!seen.has(key)) 
      {
        seen.add(key);
        unique.push(row);
      }
    });
    return unique;
  };

  const findAndReplace = (rows, searchText, replaceText) => {
    return rows.map(row =>
      row.map(cell => (typeof cell === 'string' ? cell.split(searchText).join(replaceText) : cell))
    );
  };

  const pushHistory = () => {
    setHistory(prev => [...prev, JSON.parse(JSON.stringify(grid))]);
    setFuture([]);
  };

  const updateCell = (cellId, formula) => {
    pushHistory();
    const newGrid = { ...grid };
    const newValue = evaluateFormula(formula, cellId);
    const cellDataType = newGrid[cellId].dataType || "text";
    if (cellDataType === "number" && isNaN(parseFloat(newValue))) {
      newGrid[cellId].value = "#INVALID";
    } else if (cellDataType === "date" && isNaN(Date.parse(newValue))) {
      newGrid[cellId].value = "#INVALID";
    } else {
      newGrid[cellId].value = newValue;
    }
    newGrid[cellId].formula = formula;
    Object.keys(newGrid).forEach(id => {
      const cell = newGrid[id];
      if (cell.formula && cell.formula.startsWith('=')) {
        newGrid[id] = { ...cell, value: evaluateFormula(cell.formula, id) };
      }
    });
    setGrid(newGrid);
  };

  const applyCellFormat = (formatType, value) => {
    if (!activeCell) return;
    pushHistory();
    const newGrid = { ...grid };
    const cell = newGrid[activeCell];
    const newStyle = { ...cell.style };
    switch (formatType) {
      case 'bold':
        newStyle.fontWeight = newStyle.fontWeight === 'bold' ? 'normal' : 'bold';
        break;
      case 'italic':
        newStyle.fontStyle = newStyle.fontStyle === 'italic' ? 'normal' : 'italic';
        break;
      case 'underline':
        newStyle.textDecoration = newStyle.textDecoration === 'underline' ? 'none' : 'underline';
        break;
      case 'fontsize':
        newStyle.fontSize = value;
        break;
      case 'color':
        newStyle.color = value;
        break;
      case 'bgColor':
        newStyle.backgroundColor = value;
        break;
      case 'fontFamily':
        newStyle.fontFamily = value;
        break;
        
      default:
        break;
    }
    newGrid[activeCell] = { ...cell, style: newStyle };
    setGrid(newGrid);
  };
  const convertTextCase = (caseType) => {
    if (!activeCell) return;
    
    pushHistory();
    const newGrid = { ...grid };
    const cell = newGrid[activeCell];
  
    if (caseType === 'uppercase') {
      newGrid[activeCell] = { ...cell, value: cell.value.toUpperCase() };
    } else if (caseType === 'lowercase') {
      newGrid[activeCell] = { ...cell, value: cell.value.toLowerCase() };
    }
  
    setGrid(newGrid);
  };
  
  const findAndReplaceText = () => {
    if (!findText) return;
  
    pushHistory();
    const newGrid = { ...grid };
  
    Object.keys(newGrid).forEach((cellId) => {
      const cell = newGrid[cellId];
      if (cell.value.includes(findText)) {
        newGrid[cellId] = { 
          ...cell, 
          value: cell.value.replace(new RegExp(findText, 'g'), replaceText) 
        };
      }
    });
  
    setGrid(newGrid);
  };
  

  const applyAlignment = (alignment) => {
    if (!activeCell) return;
    pushHistory();
    const newGrid = { ...grid };
    const cell = newGrid[activeCell];
    const newStyle = { ...cell.style, textAlign: alignment };
    newGrid[activeCell] = { ...cell, style: newStyle };
    setGrid(newGrid);
  };

  const handleDataTypeChange = (e) => {
    if (!activeCell) return;
    pushHistory();
    const newType = e.target.value;
    const newGrid = { ...grid };
    newGrid[activeCell].dataType = newType;
    setGrid(newGrid);
  };


  const addRow = () => {
    pushHistory();
    const newRowCount = rowCount + 1;
    const newGrid = { ...grid };
    for (let c = 0; c < colCount; c++) 
    {
      const cellId = `${rowCount},${c}`;
      newGrid[cellId] = {
        value: '',
        formula: '',
        style: {
          fontWeight: 'normal',
          fontStyle: 'normal',
          fontSize: '14px',
          color: '#000',
          textDecoration: 'none',
          textAlign: 'left'
        },
        dataType: 'text'
      };
    }
    setGrid(newGrid);
    setRowCount(newRowCount);
  };

  const addColumn = () => {
    pushHistory();
    const newColCount = colCount + 1;
    const newGrid = { ...grid };
    for (let r = 0; r < rowCount; r++) {
      const cellId = `${r},${colCount}`;
      newGrid[cellId] = {
        value: '',
        formula: '',
        style: {
          fontWeight: 'normal',
          fontStyle: 'normal',
          fontSize: '14px',
          color: '#000',
          textDecoration: 'none',
          textAlign: 'left'
        },
        dataType: 'text'
      };
    }
    setGrid(newGrid);
    setColCount(newColCount);
  };

  const deleteRow = () => {
    if (rowCount <= 1) return;
    pushHistory();
    const newRowCount = rowCount - 1;
    const newGrid = { ...grid };
    for (let c = 0; c < colCount; c++) {
      const cellId = `${newRowCount},${c}`;
      delete newGrid[cellId];
    }
    setGrid(newGrid);
    setRowCount(newRowCount);
  };

  const deleteColumn = () => {
    if (colCount <= 1) return;
    pushHistory();
    const newColCount = colCount - 1;
    const newGrid = { ...grid };
    for (let r = 0; r < rowCount; r++) {
      const cellId = `${r},${newColCount}`;
      delete newGrid[cellId];
    }
    setGrid(newGrid);
    setColCount(newColCount);
  };

  const handleColResizeStart = (colIndex, e) => {
    e.stopPropagation();
    setResizingCol(colIndex);
    setStartX(e.clientX);
    const currentWidth = colWidths[colIndex] || 80;
    setStartWidth(currentWidth);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (resizingCol !== null) {
        const deltaX = e.clientX - startX;
        const newWidth = Math.max(40, startWidth + deltaX);
        setColWidths(prev => ({ ...prev, [resizingCol]: newWidth }));
      }
    };
    const handleMouseUp = () => {
      if (resizingCol !== null) setResizingCol(null);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol, startX, startWidth]);

  const handleRowResizeStart = (rowIndex, e) => {
    e.stopPropagation();
    setResizingRow(rowIndex);
    setStartY(e.clientY);
    const currentHeight = rowHeights[rowIndex] || 24;
    setStartHeight(currentHeight);
  };

  useEffect(() => {
    const handleMouseMoveRow = (e) => {
      if (resizingRow !== null) {
        const deltaY = e.clientY - startY;
        const newHeight = Math.max(20, startHeight + deltaY);
        setRowHeights(prev => ({ ...prev, [resizingRow]: newHeight }));
      }
    };
    const handleMouseUpRow = () => {
      if (resizingRow !== null) setResizingRow(null);
    };
    document.addEventListener('mousemove', handleMouseMoveRow);
    document.addEventListener('mouseup', handleMouseUpRow);
    return () => {
      document.removeEventListener('mousemove', handleMouseMoveRow);
      document.removeEventListener('mouseup', handleMouseUpRow);
    };
  }, [resizingRow, startY, startHeight]);

  
  const handleCellClick = (row, col, e) => {
    const cellId = `${row},${col}`;
    if (e?.shiftKey && activeCell) {
      const [activeRow, activeCol] = activeCell.split(',').map(Number);
      const startRow = Math.min(activeRow, row);
      const endRow = Math.max(activeRow, row);
      const startCol = Math.min(activeCol, col);
      const endCol = Math.max(activeCol, col);
      const newSelection = [];
      for (let r = startRow; r <= endRow; r++) 
      {
        for (let c = startCol; c <= endCol; c++) 
        {
          newSelection.push(`${r},${c}`);
        }
      }
      setSelectedCells(newSelection);
    } 
    else 
    {
      setActiveCell(cellId);
      setFormulaBarValue(grid[cellId]?.formula || '');
      setSelectedCells([cellId]);
    }
  };

  const handleCellChange = (e, row, col) => {
    const cellId = `${row},${col}`;
    const value = e.target.innerText;
    updateCell(cellId, value);
    setFormulaBarValue(value);
  };

  const handleFormulaChange = (e) => {
    setFormulaBarValue(e.target.value);
    if (activeCell) {
      updateCell(activeCell, e.target.value);
    }
  };

  const handleMouseDown = (row, col, e) => {
    if (e.button !== 0) return;
    const cellId = `${row},${col}`;
    setIsSelecting(true);
    setDragStartCell(cellId);
    setDragStart(cellId);
    setIsDragging(true);
    setActiveCell(cellId);
    setSelectedCells([cellId]);
    setFormulaBarValue(grid[cellId]?.formula || '');
  };

  const handleMouseEnter = (row, col) => {
    if (!isDragging || !dragStart) return;
    const [startRow, startCol] = dragStart.split(',').map(Number);
    const startR = Math.min(startRow, row);
    const endR = Math.max(startRow, row);
    const startC = Math.min(startCol, col);
    const endC = Math.max(startCol, col);
    const newSelection = [];
    for (let r = startR; r <= endR; r++) 
    {
      for (let c = startC; c <= endC; c++) 
      {
        newSelection.push(`${r},${c}`);
      }
    }
    setSelectedCells(newSelection);
  };


  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const renderToolbar = () => (
    <div className="toolbar" style={{ position: 'relative', zIndex: 1000, pointerEvents: 'auto' }}>
      <div className="toolbar-group">
      <select className="font-family-select replace-input" onChange={(e) => applyCellFormat('fontFamily', e.target.value)}>
      <option value="Arial">Arial</option>
      <option value="Verdana">Verdana</option>
      <option value="Times New Roman">Times New Roman</option>
      <option value="Courier New">Courier New</option>
      <option value="Georgia">Georgia</option>
      <option value="Tahoma">Tahoma</option>
      </select>
      <p>Text: </p><input type="color" className="toolbar-color-picker" onChange={(e) => applyCellFormat('color', e.target.value)} />
      <p>Cell: </p><input type="color" className="toolbar-color-picker" onChange={(e) => applyCellFormat('bgColor', e.target.value)} />
        <select className="font-size-select" onChange={(e) => applyCellFormat('fontsize', e.target.value)} value={activeCell ? grid[activeCell]?.style.fontSize : '14px'}>
          {[10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30].map(size => (
            <option key={size} value={`${size}px`}>
              {size}
            </option>
          ))}
        </select>
        <button className="toolbar-button material-icons" onClick={() => applyCellFormat('bold')}>
          format_bold
        </button>
        <button className="toolbar-button material-icons" onClick={() => applyCellFormat('italic')}>
          format_italic
        </button>
        <button className="toolbar-button material-icons" onClick={() => applyCellFormat('underline')}>
          format_underlined
        </button>
        <button className="toolbar-button material-icons" onClick={() => convertTextCase('uppercase')}>  
        ▲
        </button>
        <button className="toolbar-button material-icons" onClick={() => convertTextCase('lowercase')}>  
        ▼
        </button>
          
        <div className="toolbar-divider" />
        <button className="toolbar-button material-icons" onClick={() => applyAlignment('left')}>
          format_align_left
        </button>
        <button className="toolbar-button material-icons" onClick={() => applyAlignment('center')}>
          format_align_center
        </button>
        <button className="toolbar-button material-icons" onClick={() => applyAlignment('right')}>
          format_align_right
        </button>
        <div className="toolbar-divider" />
        
        <select
          className="data-type-select"
          onChange={handleDataTypeChange}
          value={activeCell ? grid[activeCell]?.dataType : 'text'}
          disabled={!activeCell}
        >
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="date">Date</option>
        </select>
      </div>

      <div className="toolbar-group">
        <div className="formula-bar">
          <input
            type="text"
            value={formulaBarValue}
            onChange={handleFormulaChange}
            className="formula-input"
            placeholder="Enter formula"
          />
        </div>
      </div>
      <div className="toolbar-group">
        <button onClick={addRow} className="toolbar-button bg-green-500">+ Row</button>
        <button onClick={addColumn} className="toolbar-button bg-green-500">+ Col</button>
        <button onClick={deleteRow} className="toolbar-button bg-red-500">- Row</button>
        <button onClick={deleteColumn} className="toolbar-button bg-red-500">- Col</button>
      </div>
      <div className="toolbar-group">
        <input
          type="text"
          placeholder="Find"
          value={findText}
          onChange={(e) => setFindText(e.target.value)}
          className="find-input replace-input"
        />
        <input
          type="text"
          placeholder="Replace"
          value={replaceText}
          onChange={(e) => setReplaceText(e.target.value)}
          className="replace-input"
        />
        <button onClick={findAndReplaceText} className="toolbar-button bg-blue-500">
          Replace All
        </button>
      </div>

    </div>
  );

  const renderCell = (row, col) => {
    const cellId = `${row},${col}`;
    const isActive = activeCell === cellId;
    const isSelected = selectedCells.includes(cellId);
    return (
      <td
        key={col}
        className={`grid-cell ${isActive ? 'cell-active' : ''}`}
        onMouseDown={(e) => { handleMouseDown(row, col, e); handleCellClick(row, col, e); }}
        onMouseEnter={() => handleMouseEnter(row, col)}
        style={{
          width: colWidths[col] || 120,
          backgroundColor: selectedCells.includes(cellId) ? '#d0e9ff' : grid[cellId]?.style.backgroundColor || 'white', 
          ...grid[cellId]?.style,
          fontFamily: grid[cellId]?.style.fontFamily || 'Arial',
          ...grid[cellId]?.style
        }}
      >
        <div
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => handleCellChange(e, row, col)}
          ref={(el) => (cellRefs.current[cellId] = el)}
          style={{
            width: '100%',
            height: '100%',
            textDecoration: grid[cellId]?.style.textDecoration
          }}
        >
          {grid[cellId]?.value}
        </div>
      </td>
    );
  };

  const renderGrid = () => (
    <div className="sheet-grid">
      <table className="grid-table">
        <thead>
          <tr>
            <th className="row-header"></th>
            {Array.from({ length: colCount }).map((_, col) => (
              <th key={col} className="grid-header">
                {getColLetter(col)}
                <div className="resize-handle col" onMouseDown={(e) => handleColResizeStart(col, e)} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }).map((_, row) => (
            <tr key={row} style={{ height: rowHeights[row] || 24 }}>
              <th className="row-header">
                {row + 1}
                <div className="resize-handle row" onMouseDown={(e) => handleRowResizeStart(row, e)} />
              </th>
              {Array.from({ length: colCount }).map((_, col) => renderCell(row, col))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="app">
      {renderToolbar()}
      {renderGrid()}
      <div className="status-bar">
        {selectedCells.length > 1
          ? `${selectedCells.length} cells selected`
          : activeCell
          ? `${getCellRef(...activeCell.split(',').map(Number))}`
          : 'Ready'}
      </div>
    </div>
  );
};

export default GoogleSheetsClone;
