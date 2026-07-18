"use client";

export function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onCancel }: { open: boolean; title: string; description: string; confirmLabel: string; onConfirm(): void; onCancel(): void }) {
  if (!open) return null;
  return <div className="dialog-layer" role="presentation" onMouseDown={event => event.target === event.currentTarget && onCancel()}><div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-description"><span className="dialog-icon">!</span><h2 id="dialog-title">{title}</h2><p id="dialog-description">{description}</p><div><button className="secondary" onClick={onCancel}>Cancelar</button><button className="danger" onClick={onConfirm}>{confirmLabel}</button></div></div></div>;
}
