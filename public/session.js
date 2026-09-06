// Readiness, kept apart from the preview. The local handshake grants the token, the provider check starts at once, and the saved preview
// restores beside it: a slow or failed iframe never delays "Ready". Pure so tests/session.test.mjs can drive it with fake fetches; no DOM here.
// A later refresh makes an earlier one stale: its late answer is dropped, never applied.
export function createSession({localSession,providerSession,restorePreview,onLocal,onReady,onError,onPreviewError,onSettled}) {
  let sequence=0;
  return {
    async refresh(selection) {
      const current=++sequence,live=()=>current===sequence;
      try {
        const connection=await localSession();
        if(!live()) return 'stale';
        onLocal?.(connection);
        // Restoration runs alongside the provider check and owns its own failure.
        if(restorePreview) Promise.resolve().then(()=>restorePreview(connection)).catch(error=>onPreviewError?.(error));
        const session=await providerSession(selection);
        if(!live()) return 'stale';
        onReady?.(session,selection);
        return 'ready';
      } catch(error) {
        if(!live()) return 'stale';
        onError?.(error);
        return 'failed';
      } finally { if(live()) onSettled?.(); }
    },
    pending:()=>sequence
  };
}

// What a Settings change means for readiness: a new model needs the provider checked again; a new effort is a local preference and
// rides on the next request exactly as before; nothing else changed. Never both, because the selects fire one change at a time.
export function selectionChange(previous,next) {
  if(previous.model!==next.model) return 'model';
  if(previous.effort!==next.effort) return 'effort';
  return null;
}
