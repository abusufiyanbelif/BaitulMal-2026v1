
'use client';

import { Dispatch, SetStateAction } from 'react';
import { ToyBrick, Download, Trash2, Plus } from 'lucide-react';
import { type ExtractDynamicFormOutput } from '@/ai/flows/extract-dynamic-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';

type DynamicFieldsProps = {
  isLoading: boolean;
  result: ExtractDynamicFormOutput | null;
  setResult: Dispatch<SetStateAction<ExtractDynamicFormOutput | null>>;
};

export function DynamicFields({ isLoading, result, setResult }: DynamicFieldsProps) {
  if (!isLoading && !result) {
    return null;
  }
  
  const handleFieldChange = (field: keyof ExtractDynamicFormOutput, value: string) => {
    if (!result) return;
    setResult({ ...result, [field]: value });
  };
  
  const handleKeyValuePairChange = (index: number, field: 'key' | 'value', value: string) => {
    if (!result) return;
    const newFields = [...(result.fields || [])];
    newFields[index] = { ...newFields[index], [field]: value };
    setResult({ ...result, fields: newFields });
  };

  const handleRemoveField = (index: number) => {
    if (!result) return;
    const newFields = (result.fields || []).filter((_, i) => i !== index);
    setResult({ ...result, fields: newFields });
  };
  
  const handleTableCellChange = (tableIndex: number, rowIndex: number, cellIndex: number, value: string) => {
    if (!result || !result.tables) return;
    const newTables = result.tables.map((table, tIndex) => {
        if (tIndex !== tableIndex) {
            return table;
        }
        const newRows = table.rows.map((row, rIndex) => {
            if (rIndex !== rowIndex) {
                return row;
            }
            const newRow = [...row];
            newRow[cellIndex] = value;
            return newRow;
        });
        return { ...table, rows: newRows };
    });
    setResult({ ...result, tables: newTables });
  };

  const handleRemoveTableRow = (tableIndex: number, rowIndex: number) => {
    if (!result || !result.tables) return;
    const newTables = result.tables.map((table, tIndex) => {
      if (tIndex !== tableIndex) {
        return table;
      }
      const newRows = table.rows.filter((_, rIndex) => rIndex !== rowIndex);
      return { ...table, rows: newRows };
    });
    setResult({ ...result, tables: newTables });
  };
  
  const handleAddTableRow = (tableIndex: number) => {
    if (!result || !result.tables) return;
    const newTables = result.tables.map((table, tIndex) => {
        if (tIndex !== tableIndex) {
            return table;
        }
        const newRow = Array(table.headers.length).fill('');
        return { ...table, rows: [...table.rows, newRow] };
    });
    setResult({ ...result, tables: newTables });
  };
  
  const handleDownload = (format: 'json' | 'csv') => {
    if (!result) return;

    let content = '';
    let mimeType = '';
    let fileName = '';
    
    const specialFields = {
        ...(result.firstName && { firstName: result.firstName }),
        ...(result.middleName && { middleName: result.middleName }),
        ...(result.lastName && { lastName: result.lastName }),
        ...(result.country && { country: result.country }),
        ...(result.state && { state: result.state }),
        ...(result.city && { city: result.city }),
        ...(result.pinCode && { pinCode: result.pinCode }),
    };

    if (format === 'json') {
      const jsonObject = {
        ...specialFields,
        fields: result.fields.reduce((acc, { key, value }) => {
          acc[key] = value;
          return acc;
        }, {} as Record<string, string>),
        tables: result.tables.map(table => ({
          name: table.name,
          data: table.rows.map(row => 
            table.headers.reduce((acc, header, index) => {
              acc[header] = row[index];
              return acc;
            }, {} as Record<string, string>)
          )
        }))
      };
      content = JSON.stringify(jsonObject, null, 2);
      mimeType = 'application/json';
      fileName = 'extracted_data.json';
    } else { // csv
      const specialFieldsCsv = Object.entries(specialFields).map(([key, value]) => `"${key}","${value}"`).join('\n');
      const fieldsCsv = result.fields.map(({ key, value }) => `"${key.replace(/"/g, '""')}","${value.replace(/"/g, '""')}"`).join('\n');
      const tablesCsv = result.tables.map(table => {
        const header = table.headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
        const rows = table.rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
        return `\nTable: ${table.name}\n${header}\n${rows}`;
      }).join('\n');
      content = `key,value\n${specialFieldsCsv ? specialFieldsCsv + '\n' : ''}${fieldsCsv}${tablesCsv}`;
      mimeType = 'text/csv';
      fileName = 'extracted_data.csv';
    }

    const element = document.createElement('a');
    const file = new Blob([content], { type: mimeType });
    element.href = URL.createObjectURL(file);
    element.download = fileName;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };
  
  const hasName = result?.firstName || result?.middleName || result?.lastName;
  const hasAddress = result?.city || result?.state || result?.country || result?.pinCode;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ToyBrick className="w-6 h-6" />
          Extracted Fields
        </CardTitle>
        {result && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleDownload('json')}>
              <Download className="mr-2 h-4 w-4" /> Json
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDownload('csv')}>
              <Download className="mr-2 h-4 w-4" /> Csv
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-2">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-10 w-2/3" />
              </div>
            ))}
          </div>
        )}
        
        {!isLoading && result && (
          <div className="space-y-6">
            {/* Name Fields */}
            {hasName && (
              <div className="space-y-3">
                <h3 className="font-medium text-lg">Name</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {result.firstName && (
                        <div className="space-y-2">
                            <Label htmlFor="firstName">First Name</Label>
                            <Input id="firstName" value={result.firstName} onChange={(e) => handleFieldChange('firstName', e.target.value)} />
                        </div>
                    )}
                    {result.middleName && (
                        <div className="space-y-2">
                            <Label htmlFor="middleName">Middle Name</Label>
                            <Input id="middleName" value={result.middleName} onChange={(e) => handleFieldChange('middleName', e.target.value)} />
                        </div>
                    )}
                    {result.lastName && (
                         <div className="space-y-2">
                            <Label htmlFor="lastName">Last Name</Label>
                            <Input id="lastName" value={result.lastName} onChange={(e) => handleFieldChange('lastName', e.target.value)} />
                        </div>
                    )}
                </div>
              </div>
            )}
            
            {/* Address Fields */}
            {hasAddress && (
              <div className="space-y-3">
                 <h3 className="font-medium text-lg">Address</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {result.city && (
                        <div className="space-y-2">
                            <Label htmlFor="city">City</Label>
                            <Input id="city" value={result.city} onChange={(e) => handleFieldChange('city', e.target.value)} />
                        </div>
                    )}
                    {result.state && (
                        <div className="space-y-2">
                            <Label htmlFor="state">State</Label>
                            <Input id="state" value={result.state} onChange={(e) => handleFieldChange('state', e.target.value)} />
                        </div>
                    )}
                    {result.country && (
                         <div className="space-y-2">
                            <Label htmlFor="country">Country</Label>
                            <Input id="country" value={result.country} onChange={(e) => handleFieldChange('country', e.target.value)} />
                        </div>
                    )}
                     {result.pinCode && (
                         <div className="space-y-2">
                            <Label htmlFor="pinCode">Pin Code</Label>
                            <Input id="pinCode" value={result.pinCode} onChange={(e) => handleFieldChange('pinCode', e.target.value)} />
                        </div>
                    )}
                </div>
              </div>
            )}
            
            {/* Key-Value Pairs */}
            {result.fields?.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium text-lg">Other Fields</h3>
                <div className="max-h-[24rem] overflow-y-auto pr-2 space-y-3">
                    {result.fields.map((field, index) => (
                    <div key={index} className="grid grid-cols-[1fr_2fr_auto] gap-2 items-center">
                        <Input
                        value={field.key}
                        onChange={(e) => handleKeyValuePairChange(index, 'key', e.target.value)}
                        placeholder="Key"
                        className="font-code"
                        />
                        <Input
                        value={field.value}
                        onChange={(e) => handleKeyValuePairChange(index, 'value', e.target.value)}
                        placeholder="Value"
                        className="font-code"
                        />
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveField(index)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                    </div>
                    ))}
                </div>
              </div>
            )}

            {/* Tables */}
            {result.tables?.map((table, tableIndex) => (
              <div key={tableIndex} className="space-y-2">
                <h3 className="font-medium text-lg">{table.name}</h3>
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {table.headers.map((header, headerIndex) => (
                          <TableHead key={headerIndex}>{header}</TableHead>
                        ))}
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {table.rows.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <TableCell key={cellIndex}>
                               <Input
                                value={cell}
                                onChange={(e) => handleTableCellChange(tableIndex, rowIndex, cellIndex, e.target.value)}
                                placeholder={`Row ${rowIndex+1}, Col ${cellIndex+1}`}
                                className="font-code"
                              />
                            </TableCell>
                          ))}
                           <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveTableRow(tableIndex, rowIndex)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                 <Button variant="outline" size="sm" onClick={() => handleAddTableRow(tableIndex)}>
                  <Plus className="mr-2 h-4 w-4" /> Add Row
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
