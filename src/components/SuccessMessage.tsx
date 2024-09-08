const SuccessMessage = ({ clear }: { clear: Function }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6">
      <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
        <svg
          className="w-12 h-12 text-green-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M5 13l4 4L19 7"
          ></path>
        </svg>
      </div>
      <h1 className="mt-4 text-2xl font-bold text-green-700">Success!</h1>
      <p className="mt-2 text-gray-600">
        HTML timetables were generated and downloaded successfully.
      </p>
      <p className="mt-1 text-sm text-gray-600">
        Look for <code>timetables.zip</code> in your downloads folder.
      </p>
      <button className="mt-2" onClick={() => clear()}>
        Generate More Timetables
      </button>
    </div>
  );
};

export default SuccessMessage;
