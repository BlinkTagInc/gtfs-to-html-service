import { useState } from 'react';

export const OptionsEditor = ({
  options,
  setOptions,
  showOptionsEditor,
  setShowOptionsEditor,
}: {
  options: string;
  setOptions: (options: string) => void;
  showOptionsEditor: boolean;
  setShowOptionsEditor: (showOptionsEditor: boolean) => void;
}) => {
  if (showOptionsEditor) {
    return (
      <>
        <h2 className="text-xl font-bold mt-4 mb-0">GTFS-to-HTML Options</h2>
        <a
          href="https://gtfstohtml.com/docs/configuration"
          target="_blank"
          className="text-sm"
        >
          View Documentation
        </a>
        <textarea
          className="w-full p-2 mt-2 border border-gray-300 rounded h-[600px]"
          value={options}
          onChange={(e) => setOptions(e.target.value)}
        />
      </>
    );
  }

  return (
    <button
      type="button"
      className="no-style"
      onClick={() => setShowOptionsEditor(true)}
    >
      Customize Options
    </button>
  );
};
