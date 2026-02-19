
'use client';

export function BrandedLoader() {
  // The main loading indicator is now the zooming watermark.
  // This component just provides a full-screen overlay to prevent
  // interaction with the page while it's loading.
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
      {/* The content has been removed as per the request. */}
    </div>
  );
}
