import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail } from 'lucide-react';

interface EmailChangeDialogProps {
  open: boolean;
  changingEmail: boolean;
  currentEmail: string;
  newEmail: string;
  emailChangeError: string;
  onOpenChange: (open: boolean) => void;
  onNewEmailChange: (value: string) => void;
  onClearError: () => void;
  onSubmit: () => void;
}

export function EmailChangeDialog({
  open,
  changingEmail,
  currentEmail,
  newEmail,
  emailChangeError,
  onOpenChange,
  onNewEmailChange,
  onClearError,
  onSubmit,
}: EmailChangeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Change Email Address
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You&apos;ll receive a verification email at your new address. Your email won&apos;t
            change until you click the verification link.
          </p>

          <div className="space-y-4">
            <div>
              <Label htmlFor="currentEmail" className="mb-2 block">
                Current Email
              </Label>
              <Input
                id="currentEmail"
                type="email"
                value={currentEmail}
                disabled
                className="bg-muted rounded-lg"
              />
            </div>

            <div>
              <Label htmlFor="newEmailInput" className="mb-2 block">
                New Email Address
              </Label>
              <Input
                id="newEmailInput"
                type="email"
                value={newEmail}
                onChange={(event) => {
                  onNewEmailChange(event.target.value);
                  onClearError();
                }}
                placeholder="Enter your new email"
                className="rounded-lg"
                disabled={changingEmail}
              />
              {emailChangeError && <p className="text-xs text-red-500 mt-1">{emailChangeError}</p>}
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>What happens next:</strong>
                <br />
                1. We&apos;ll send a verification link to your new email
                <br />
                2. Click the link to confirm the change
                <br />
                3. Your email will be updated automatically
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={changingEmail}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={changingEmail || !newEmail.trim()} className="rounded-lg">
              {changingEmail ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Verification
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
