export const Loading = ({
  url,
  title = 'Generating HTML timetables',
}: {
  url: string;
  title?: string;
}) => {
  return (
    <div className="loading flex flex-row items-start gap-2">
      <div className="loader"></div>
      <div className="text-sm break-words">
        <h2 className="mb-0">{title}</h2>
        {url && `Source: ${url}`}
      </div>
      <style jsx>{`
        .loader {
          width: 50px;
          aspect-ratio: 1;
          border-radius: 50%;
          border: 8px solid;
          border-color: #000 #0000;
          animation: l1 1s infinite;
        }
        @keyframes l1 {
          to {
            transform: rotate(0.5turn);
          }
        }
      `}</style>
    </div>
  );
};
