import { useEffect, useRef, useState } from "react";
import { getContentData } from "../utils/hiveUtils";
import { useAppStore } from "../lib/store";


function LazyPayout({ author, permlink, setVotersNum, setHasVoted1 }) {
  const [payout, setPayout] = useState(null);
  // const [voters, setVoters] = useState(null);
  const ref = useRef();
  const {user:active_user} = useAppStore();



  useEffect(() => {
    // Detect if running in TV/iframe mode (Tizen WebView or embedded iframe)
    const isTvMode = window.parent !== window || navigator.userAgent.includes('Tizen');

    const fetchData = async () => {
      try {
        const data = await getContentData(active_user, author, permlink, setHasVoted1);
        if (data) {
          setPayout(data.payout);
          setVotersNum(data.voters);
          setHasVoted1(data.isVoted);
        }
      } catch (err) {
        console.error("Error fetching payout:", err);
      }
    };

    // TV mode: skip IntersectionObserver (doesn't work reliably in Tizen WebView)
    if (isTvMode) {
      fetchData();
      return;
    }

    // Regular browser: use lazy loading with IntersectionObserver
    const observer = new IntersectionObserver(async (entries) => {
      if (entries[0].isIntersecting) {
        await fetchData();
        observer.disconnect();
      }
    });

    if (ref.current) observer.observe(ref.current);

    return () => observer.disconnect();
  }, [author, permlink]);

  return (
    <div ref={ref}>
      <p>$ {payout ?? "…"}</p>
      {/* <p>Voters: {voters ?? "…"}</p> */}
    </div>
  );
}

export default LazyPayout;
