"use client";

import { trpc } from "@/app/_trpc/client";
import { useState } from "react";
import { SignatureCapture } from "../signature/SignatureCapture";

interface DocumentSignerProps {
  documentId: bigint;
  userRole: "Company Representative" | "Signer";
  onSigningComplete: () => void;
}

export function DocumentSigner({ documentId, userRole, onSigningComplete }: DocumentSignerProps) {
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureData, setSignatureData] = useState<any>(null);

  const { data: signingData, isLoading } = trpc.documents.internal.getSigningData.useQuery({
    documentId,
  });

  const signMutation = trpc.documents.internal.sign.useMutation({
    onSuccess: () => {
      setShowSignatureModal(false);
      onSigningComplete();
    },
    onError: (error) => {
      console.error('Signing failed:', error);
    }
  });

  const handleSignature = (signature: { type: "draw"; data: string }) => {
    setSignatureData(signature);
  };

  const handleSubmitSignature = () => {
    if (!signatureData) return;

    signMutation.mutate({
      documentId,
      signatureData: {
        type: signatureData.type,
        data: signatureData.data,
        page: 1, // For now, always sign on page 1
        x: 100,  // Default position
        y: 100,
      },
      role: userRole,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading document...</div>
      </div>
    );
  }

  if (!signingData) {
    return (
      <div className="text-red-600">
        Document not found or you don't have permission to sign it.
      </div>
    );
  }

  const { document, fileContent, status } = signingData;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h1 className="text-2xl font-bold text-gray-900">{document.name}</h1>
          <div className="mt-2 flex items-center space-x-4">
            <span className={`px-2 py-1 rounded text-sm font-medium ${
              status === 'signed' ? 'bg-green-100 text-green-800' :
              status === 'partially_signed' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {status === 'unsigned' ? 'Ready to Sign' :
               status === 'partially_signed' ? 'Partially Signed' :
               'Fully Signed'}
            </span>
            <span className="text-sm text-gray-500">Role: {userRole}</span>
          </div>
        </div>

        <div className="p-6">
          {/* PDF Viewer */}
          <div className="mb-8">
            <h2 className="text-lg font-medium mb-4">Document Preview</h2>
            {fileContent ? (
              <div className="border rounded-lg p-4 bg-gray-50">
                <embed
                  src={`data:application/pdf;base64,${fileContent}`}
                  type="application/pdf"
                  width="100%"
                  height="600px"
                  className="rounded"
                />
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
                No document content available
              </div>
            )}
          </div>

          {/* Signature Section */}
          {status !== 'signed' && (
            <div className="border-t pt-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium">Your Signature Required</h2>
                <button
                  onClick={() => setShowSignatureModal(true)}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Sign Document
                </button>
              </div>

              {/* Signature Modal */}
              {showSignatureModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium">Sign as {userRole}</h3>
                      <button
                        onClick={() => setShowSignatureModal(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    </div>

                    <SignatureCapture onSignature={handleSignature} />

                    <div className="mt-6 flex gap-4">
                      <button
                        onClick={() => setShowSignatureModal(false)}
                        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmitSignature}
                        disabled={!signatureData || signMutation.isLoading}
                        className="flex-1 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                      >
                        {signMutation.isLoading ? 'Signing...' : 'Complete Signature'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Document Info */}
          <div className="mt-8 bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium mb-2">Document Information</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Document ID: {document.id.toString()}</p>
              <p>Created: {new Date(document.createdAt).toLocaleDateString()}</p>
              <p>Status: {status}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
