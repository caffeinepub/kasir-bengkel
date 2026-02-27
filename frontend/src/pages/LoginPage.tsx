import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const { login, loginStatus } = useInternetIdentity();
  const isLoggingIn = loginStatus === 'logging-in';

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8 text-center">
        {/* Logo / Brand */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand flex items-center justify-center shadow-lg">
            <Wrench className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Bengkel POS</h1>
            <p className="text-muted-foreground text-sm mt-1">Sistem Manajemen Bengkel</p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Masuk ke Aplikasi</h2>
            <p className="text-sm text-muted-foreground">
              Silakan login untuk mengakses sistem manajemen bengkel.
            </p>
          </div>

          <Button
            onClick={() => login()}
            disabled={isLoggingIn}
            className="w-full bg-brand hover:bg-brand/90 text-white font-medium"
            size="lg"
          >
            {isLoggingIn ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sedang Masuk...
              </span>
            ) : (
              'Login'
            )}
          </Button>

          <p className="text-xs text-muted-foreground">
            Menggunakan Internet Identity untuk keamanan data Anda.
          </p>
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Bengkel POS &mdash; Dibangun dengan ❤️ menggunakan{' '}
          <a
            href={`https://caffeine.ai/?utm_source=Caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground transition-colors"
          >
            caffeine.ai
          </a>
        </p>
      </div>
    </div>
  );
}
