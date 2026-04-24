import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, Save, Trash2, X } from 'lucide-react';

interface CredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  onClear: () => void;
  modalBotKey: string;
  setModalBotKey: (value: string) => void;
  modalAppId: string;
  setModalAppId: (value: string) => void;
  modalPublicKey: string;
  setModalPublicKey: (value: string) => void;
  isSavingCredentials: boolean;
}

export function CredentialsModal({
  isOpen,
  onClose,
  onSave,
  onClear,
  modalBotKey,
  setModalBotKey,
  modalAppId,
  setModalAppId,
  modalPublicKey,
  setModalPublicKey,
  isSavingCredentials,
}: CredentialsModalProps) {
  const [isBotKeyVisible, setIsBotKeyVisible] = useState(false);
  const [isAppIdVisible, setIsAppIdVisible] = useState(false);
  const [isPublicKeyVisible, setIsPublicKeyVisible] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-5 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Manage Credentials</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div>
          <label htmlFor="modalBotTokenKey" className="block text-sm font-medium text-gray-300 mb-1.5">
            Discord Bot Token <span className="text-red-400">*</span>
          </label>
          <div className="flex items-center space-x-2">
            <input
              id="modalBotTokenKey"
              type={isBotKeyVisible ? 'text' : 'password'}
              value={modalBotKey}
              onChange={(event) => setModalBotKey(event.target.value)}
              placeholder="Paste Bot Token here"
              className="flex-grow px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsBotKeyVisible(!isBotKeyVisible);
              }}
              className="p-2 text-gray-400 hover:text-white bg-gray-700 rounded-md border border-gray-600"
            >
              {isBotKeyVisible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="modalAppId" className="block text-sm font-medium text-gray-300 mb-1">
            Application ID *
          </label>
          <div className="flex items-center space-x-2">
            <input
              id="modalAppId"
              type={isAppIdVisible ? 'text' : 'password'}
              value={modalAppId}
              onChange={(event) => setModalAppId(event.target.value)}
              placeholder="Enter Discord Application ID"
              className="flex-grow px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsAppIdVisible(!isAppIdVisible);
              }}
              className="p-2 text-gray-400 hover:text-white"
            >
              {isAppIdVisible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="modalPublicKey" className="block text-sm font-medium text-gray-300 mb-1">
            Public Key *
          </label>
          <div className="flex items-center space-x-2">
            <input
              id="modalPublicKey"
              type={isPublicKeyVisible ? 'text' : 'password'}
              value={modalPublicKey}
              onChange={(event) => setModalPublicKey(event.target.value)}
              placeholder="Enter Discord App Public Key"
              className="flex-grow px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsPublicKeyVisible(!isPublicKeyVisible);
              }}
              className="p-2 text-gray-400 hover:text-white"
            >
              {isPublicKeyVisible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onClear();
            }}
            className="flex items-center px-3 py-1.5 text-gray-400 hover:text-red-400 text-sm transition-colors"
          >
            <Trash2 size={14} className="mr-1.5" /> Disconnect
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSave();
            }}
            disabled={isSavingCredentials}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center"
          >
            {isSavingCredentials ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" /> Saving...
              </>
            ) : (
              <>
                <Save size={16} className="mr-2" /> Save Credentials
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
