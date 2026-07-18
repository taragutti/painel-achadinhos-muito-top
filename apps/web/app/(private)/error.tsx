"use client";
export default function ErrorState({ reset }: { error: Error & { digest?: string }; reset(): void }) { return <div className="error-state"><span>!</span><h1>Não foi possível carregar esta área</h1><p>Tente novamente. Se o problema continuar, verifique a configuração do painel.</p><button className="primary" onClick={reset}>Tentar novamente</button></div>; }
