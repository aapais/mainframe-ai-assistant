import React from 'react';
import { Upload, FileText, File, Table, X, Info } from 'lucide-react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
  ModalClose
} from '../ui/Modal';

export interface BulkUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BulkUploadModal: React.FC<BulkUploadModalProps> = ({
  open,
  onOpenChange
}) => {
  const fileTypes = [
    {
      icon: FileText,
      name: 'PDF',
      description: 'Documentos de incidentes e soluções',
      color: 'text-red-500',
      bgColor: 'bg-red-50'
    },
    {
      icon: FileText,
      name: 'Word',
      description: 'Documentos .doc/.docx',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50'
    },
    {
      icon: Table,
      name: 'Excel',
      description: 'Planilhas .xls/.xlsx',
      color: 'text-green-500',
      bgColor: 'bg-green-50'
    },
    {
      icon: File,
      name: 'TXT',
      description: 'Arquivos de texto simples',
      color: 'text-gray-500',
      bgColor: 'bg-gray-50'
    }
  ];

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="2xl" open={open}>
        <ModalClose onClick={() => onOpenChange(false)}>
          <X className="h-4 w-4" />
        </ModalClose>

        <ModalHeader>
          <ModalTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-[#A100FF]/10">
              <Upload className="w-6 h-6 text-[#A100FF]" />
            </div>
            Upload em Massa
          </ModalTitle>
        </ModalHeader>

        <ModalBody className="space-y-6">
          {/* Development Notice */}
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-amber-800 mb-1">
                Funcionalidade em Desenvolvimento
              </h3>
              <p className="text-sm text-amber-700">
                Esta funcionalidade está sendo desenvolvida e estará disponível em breve.
                Por enquanto, você pode adicionar incidentes individualmente através do botão "+" na tela principal.
              </p>
            </div>
          </div>

          {/* Drag & Drop Zone Placeholder */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
            <div className="space-y-4">
              <div className="mx-auto w-16 h-16 bg-[#A100FF]/10 rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 text-[#A100FF]" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Arraste e solte seus arquivos aqui
                </h3>
                <p className="text-gray-500 mb-4">
                  ou clique para selecionar arquivos do seu computador
                </p>
                <button
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#A100FF] hover:bg-[#8000CC] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#A100FF] disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Selecionar Arquivos
                </button>
              </div>
            </div>
          </div>

          {/* Supported File Types */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              Tipos de arquivo suportados:
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {fileTypes.map((type, index) => {
                const Icon = type.icon;
                return (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${type.bgColor} border-gray-200`}
                  >
                    <Icon className={`w-5 h-5 ${type.color}`} />
                    <div>
                      <div className="font-medium text-gray-900">{type.name}</div>
                      <div className="text-xs text-gray-600">{type.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Progress Indicator Placeholder */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900">
              Progresso do Upload:
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Processando arquivos...</span>
                <span className="text-gray-500">0%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-[#A100FF] h-2 rounded-full transition-all duration-300"
                  style={{ width: '0%' }}
                ></div>
              </div>
            </div>
          </div>

          {/* Future Features Preview */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="font-medium text-gray-900 mb-3">
              Recursos que estarão disponíveis:
            </h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#A100FF] rounded-full"></div>
                Processamento automático de texto com IA
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#A100FF] rounded-full"></div>
                Extração de informações de incidentes
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#A100FF] rounded-full"></div>
                Categorização automática
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#A100FF] rounded-full"></div>
                Validação de duplicatas
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#A100FF] rounded-full"></div>
                Relatório de importação detalhado
              </li>
            </ul>
          </div>
        </ModalBody>

        <ModalFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#A100FF]"
          >
            Fechar
          </button>
          <button
            type="button"
            className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#A100FF] hover:bg-[#8000CC] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#A100FF] disabled:opacity-50 disabled:cursor-not-allowed"
            disabled
          >
            <Upload className="w-4 h-4 mr-2" />
            Iniciar Upload
          </button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default BulkUploadModal;