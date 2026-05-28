import { useNavigate } from "react-router-dom";

export function useCheckout() {
  const navigate = useNavigate();

  const startCheckout = () => {
    // Navigate to the integrated checkout page
    navigate("/checkout");
  };

  return { startCheckout, isLoading: false };
}

