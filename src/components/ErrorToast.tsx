export function ErrorToast({
  error,
  showPresetLink,
  onBrowsePresets,
  onDismiss,
}: {
  error: string;
  showPresetLink: boolean;
  onBrowsePresets: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 flex items-start gap-2">
      <svg className="h-5 w-5 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      <div className="flex-1">
        <p className="text-sm text-red-300">{error}</p>
        {showPresetLink && (
          <button
            onClick={onBrowsePresets}
            className="mt-1.5 text-xs text-vt-dim hover:text-vt underline underline-offset-2 transition-colors"
          >
            Browse preset strategies
          </button>
        )}
      </div>
      <button onClick={onDismiss} className="text-red-400 hover:text-red-300">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
