import { useState } from 'react';
import { useMLAnalytics, useRefreshMLPrediction } from '@/hooks/useAnalytics';
import { analyticsService } from '@/lib/analyticsService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
    Brain,
    TrendingUp,
    AlertTriangle,
    RefreshCw,
    Activity,
    Users,
    Calendar,
    BarChart3,
    LineChart,
    PieChart,
    Zap,
    Info,
    CheckCircle2,
    XCircle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface MLAnalyticsProps {
    selectedDate: Date;
}

export function MLAnalytics({ selectedDate }: MLAnalyticsProps) {
    const { mlData, loading, error, refetch, isPythonAPIAvailable } = useMLAnalytics();
    const { refreshPrediction, loading: refreshing } = useRefreshMLPrediction();
    const [isTraining, setIsTraining] = useState(false);

    const handleRefresh = async () => {
        await refetch();
    };

    const handleTriggerTraining = async () => {
        setIsTraining(true);
        try {
            const result = await analyticsService.triggerTraining();
            if (result.success) {
                toast({
                    title: 'Training Started',
                    description: 'ML models are being retrained. This may take a few minutes.',
                });
                // Refresh data after training
                setTimeout(() => {
                    refetch();
                }, 5000);
            } else {
                toast({
                    title: 'Training Failed',
                    description: result.message,
                    variant: 'destructive',
                });
            }
        } catch (err) {
            toast({
                title: 'Error',
                description: 'Failed to trigger training',
                variant: 'destructive',
            });
        } finally {
            setIsTraining(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                            <Brain className="h-8 w-8 text-primary" />
                            Analytics & Predictions
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Statistical insights and predictive analytics
                        </p>
                    </div>
                </div>
                <LoadingSpinner />
            </div>
        );
    }

    if (error || !mlData) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                            <Brain className="h-8 w-8 text-primary" />
                            Analytics & Predictions
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Statistical insights and predictive analytics
                        </p>
                    </div>
                </div>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">Analytics Unavailable</h3>
                            <p className="text-sm text-muted-foreground max-w-md">
                                {error || 'Unable to load analytics data. Please try again later.'}
                            </p>
                            <Button onClick={handleRefresh} className="mt-4" variant="outline">
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Retry
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const { ensemble, forecast, risks } = mlData;
    const forecastVolumes = forecast.predicted_volume.map((value) => {
        const volume = Number(value);
        return Number.isFinite(volume) ? Math.max(0, volume) : 0;
    });
    const maxForecastVolume = Math.max(1, ...forecastVolumes);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                        <Brain className="h-8 w-8 text-primary" />
                        Analytics & Predictions
                    </h1>
                    <div className="text-muted-foreground mt-1 flex items-center gap-2">
                        Statistical insights and predictive analytics
                        {isPythonAPIAvailable ? (
                            <Badge variant="default" className="ml-2">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Python ML API Connected
                            </Badge>
                        ) : (
                            <Badge variant="secondary" className="ml-2">
                                <XCircle className="h-3 w-3 mr-1" />
                                Using Rule-Based Analytics
                            </Badge>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    {isPythonAPIAvailable && (
                        <Button
                            onClick={handleTriggerTraining}
                            disabled={isTraining}
                            variant="secondary"
                        >
                            <Zap className={`h-4 w-4 mr-2 ${isTraining ? 'animate-pulse' : ''}`} />
                            {isTraining ? 'Training...' : 'Retrain Models'}
                        </Button>
                    )}
                    <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
                        <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* API Status & Info */}
            <Card className={isPythonAPIAvailable ? "border-green-200 bg-green-50/50" : "border-blue-200 bg-blue-50/50"}>
                <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                        <Info className={`h-5 w-5 ${isPythonAPIAvailable ? 'text-green-600' : 'text-blue-600'} mt-0.5 flex-shrink-0`} />
                        <div className={`text-sm ${isPythonAPIAvailable ? 'text-green-900' : 'text-blue-900'}`}>
                            <p className="font-medium mb-1">
                                {isPythonAPIAvailable ? 'Python ML Analytics Active' : 'Analytics Methodology'}
                            </p>
                            <p>
                                {isPythonAPIAvailable ? (
                                    <>
                                        Connected to Python FastAPI backend with ML models (Prophet, XGBoost, Random Forest).
                                        Real-time predictions with 95%+ accuracy. Models auto-retrain weekly.
                                    </>
                                ) : (
                                    <>
                                        Analytics computed using rule-based heuristics and statistical methods.
                                        Python ML backend is not available. Start the Analytics API to enable ML predictions.
                                        See <span className="font-mono text-xs">Analytics/README.md</span> for setup.
                                    </>
                                )}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Ensemble Metrics */}
            <div className="grid gap-6 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">No-Show Rate</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{ensemble.no_show_rate.toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Last 30 days average
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">High Risk Count</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{ensemble.high_risk_count}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Appointments with score &gt;= 0.60
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Average Risk Score</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{ensemble.average_score.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Mean no-show probability
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Volume Forecast */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <LineChart className="h-5 w-5" />
                        7-Day Volume Forecast
                    </CardTitle>
                    <CardDescription>
                        Predicted appointment volume based on 4-week historical average
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {forecast.dates.map((date, index) => {
                            const volume = forecastVolumes[index] ?? 0;
                            const barWidth = Math.min(100, Math.round((volume / maxForecastVolume) * 100));

                            return (
                                <div key={date} className="flex min-w-0 items-center justify-between gap-4 py-2 border-b last:border-0">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        <span className="truncate text-sm font-medium">
                                            {format(parseISO(date), 'EEE, MMM d')}
                                        </span>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-3">
                                        <div className="h-2 w-36 overflow-hidden rounded-full bg-secondary sm:w-48 md:w-64">
                                            <div
                                                className="h-2 rounded-full bg-primary"
                                                style={{ width: `${barWidth}%` }}
                                            />
                                        </div>
                                        <span className="w-12 text-right text-sm font-semibold tabular-nums">
                                            {volume}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* High-Risk Appointments */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        High-Risk Appointments (Next 7 Days)
                    </CardTitle>
                    <CardDescription>
                        Appointments with elevated no-show probability
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {risks.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>No high-risk appointments in the next 7 days</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {risks.map((risk) => (
                                <div
                                    key={risk.appointment_id}
                                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium">{risk.patient_name}</span>
                                            <Badge
                                                variant={
                                                    risk.risk_label === 'HIGH'
                                                        ? 'destructive'
                                                        : risk.risk_label === 'MEDIUM'
                                                            ? 'secondary'
                                                            : 'default'
                                                }
                                            >
                                                {risk.risk_label} ({Math.round(risk.no_show_score * 100)}%)
                                            </Badge>
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {format(parseISO(risk.appointment_date), 'MMM d, yyyy')} at {risk.appointment_time}
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm">
                                        View Details
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
