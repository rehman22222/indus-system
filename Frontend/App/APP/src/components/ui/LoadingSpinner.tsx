/**
 * Lightweight loading spinner for Suspense fallback
 * Pure Tailwind CSS - no external dependencies
 */

export function LoadingSpinner() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="flex flex-col items-center gap-4">
                <div className="relative w-16 h-16">
                    <div className="absolute top-0 left-0 w-full h-full border-4 border-primary/20 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-full h-full border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
        </div>
    );
}
