declare module 'react-pivottable' {
  import { Component } from 'react';

  export interface PivotTableProps {
    data: Array<Record<string, any>>;
    rows?: string[];
    cols?: string[];
    vals?: string[];
    aggregatorName?: string;
    rendererName?: string;
    sorters?: Record<string, (a: string, b: string) => number>;
    plotlyOptions?: Record<string, any>;
    plotlyConfig?: Record<string, any>;
    tableOptions?: Record<string, any>;
    onChange?: (state: PivotTableState) => void;
    hiddenAttributes?: string[];
    hiddenFromAggregators?: string[];
    hiddenFromDragDrop?: string[];
    unusedOrientationCutoff?: number;
    menuLimit?: number;
  }

  export interface PivotTableState {
    rows: string[];
    cols: string[];
    vals: string[];
    aggregatorName: string;
    rendererName: string;
    valueFilter?: Record<string, Record<string, boolean>>;
    sorters?: Record<string, (a: string, b: string) => number>;
    derivedAttributes?: Record<string, (record: Record<string, any>) => any>;
    rowOrder?: string;
    colOrder?: string;
  }

  export class PivotTable extends Component<PivotTableProps> {}
  export class PivotTableUI extends Component<PivotTableProps & { [key: string]: any }> {}
  
  export const aggregators: Record<string, (attributeArray?: string[]) => {
    push: (record: Record<string, any>) => void;
    value: () => number;
    format: (x: number) => string;
    numInputs: number;
  }>;
  
  export const derivers: Record<string, (attributeArray: string[]) => (record: Record<string, any>) => any>;
  
  export default PivotTableUI;
}

declare module 'react-pivottable/PivotTableUI' {
  import { Component } from 'react';
  import { PivotTableProps } from 'react-pivottable';
  
  export default class PivotTableUI extends Component<PivotTableProps & { [key: string]: any }> {}
}

declare module 'react-pivottable/TableRenderers' {
  const TableRenderers: Record<string, any>;
  export default TableRenderers;
}

declare module 'react-pivottable/PivotTable' {
  import { Component } from 'react';
  import { PivotTableProps } from 'react-pivottable';
  
  export default class PivotTable extends Component<PivotTableProps> {}
}
