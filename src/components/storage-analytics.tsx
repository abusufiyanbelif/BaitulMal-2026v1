'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getStorageAnalytics } from '@/app/analytics/actions';
import { Loader2, Files, Image as ImageIcon, HardDrive, Folder } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';

interface StorageAnalyticsData {
    totalFiles: number;
    totalSize: number;
    imageCount: number;
    fileTypes: { type: string, count: number, size: number }[];
    folderCount: number;
}

function StatCard({ title, value, icon: Icon, isLoading, unit = '' }: { title: string, value: string, icon: React.ComponentType<{className?: string}>, isLoading: boolean, unit?: string }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <Skeleton className="h-8 w-1/2" />
                ) : (
                    <div className="text-2xl font-bold">{value}{unit && <span className="text-sm text-muted-foreground ml-1">{unit}</span>}</div>
                )}
            </CardContent>
        </Card>
    )
}

function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}


export function StorageAnalytics() {
    const [data, setData] = useState<StorageAnalyticsData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFetchAnalytics = async () => {
        setIsLoading(true);
        setError(null);
        const result = await getStorageAnalytics();
        if ('error' in result) {
            setError(result.error);
        } else {
            // @ts-ignore
            setData(result);
        }
        setIsLoading(false);
    };

    const fileTypeChartData = data?.fileTypes.slice(0, 10) || [];
    const fileTypeChartConfig: ChartConfig = fileTypeChartData.reduce((acc, { type }) => {
        acc[type] = {
            label: type.toUpperCase(),
            color: `hsl(var(--chart-${(Object.keys(acc).length % 5) + 1}))`,
        };
        return acc;
    }, {} as ChartConfig);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Storage Analytics</CardTitle>
                <CardDescription>
                    An overview of your Firebase Storage usage. This can be slow on large buckets. Click the button to load or refresh the data.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <Button onClick={handleFetchAnalytics} disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {data ? 'Refresh Storage Data' : 'Load Storage Data'}
                </Button>

                {(isLoading && !data) && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[105px]"/>)}
                    </div>
                )}

                {error && (
                    <div className="text-center text-destructive py-10">
                        <p>Failed to load storage analytics:</p>
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {data && (
                    <div className="space-y-6 animate-fade-in-up">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                           <StatCard title="Total Files" value={data.totalFiles.toLocaleString()} icon={Files} isLoading={false} />
                           <StatCard title="Total Size" value={formatBytes(data.totalSize)} icon={HardDrive} isLoading={false} />
                           <StatCard title="Image Files" value={data.imageCount.toLocaleString()} icon={ImageIcon} isLoading={false} />
                           <StatCard title="Folders" value={data.folderCount.toLocaleString()} icon={Folder} isLoading={false} />
                        </div>
                        
                        <Card>
                            <CardHeader>
                                <CardTitle>Top 10 File Types by Count</CardTitle>
                            </CardHeader>
                            <CardContent>
                               <ChartContainer config={fileTypeChartConfig} className="h-[300px] w-full">
                                    <BarChart data={fileTypeChartData} accessibilityLayer>
                                        <CartesianGrid vertical={false} />
                                        <XAxis dataKey="type" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                                        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                          {fileTypeChartData.map((entry) => (
                                              <Cell key={`cell-${entry.type}`} fill={`var(--color-${entry.type})`} />
                                          ))}
                                        </Bar>
                                    </BarChart>
                                </ChartContainer>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
