const UsageTracker = (() => {
  
  const FREE_TIER_LIMIT = 50;
  const STORAGE_KEY = 'bhaskara_usage';
  const MONTH_KEY = 'bhaskara_month';

  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const getUsageData = () => {
    const storedMonth = localStorage.getItem(MONTH_KEY);
    const currentMonth = getCurrentMonth();
    
    if (storedMonth !== currentMonth) {
      resetUsage();
      return { count: 0, month: currentMonth };
    }
    
    const count = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    return { count, month: currentMonth };
  };

  const incrementCalculation = () => {
    const usage = getUsageData();
    usage.count += 1;
    
    localStorage.setItem(STORAGE_KEY, usage.count.toString());
    localStorage.setItem(MONTH_KEY, usage.month);
    
    return usage.count;
  };

  const canCalculate = () => {
    const usage = getUsageData();
    return usage.count < FREE_TIER_LIMIT;
  };

  const getRemainingCalculations = () => {
    const usage = getUsageData();
    return Math.max(0, FREE_TIER_LIMIT - usage.count);
  };

  const getUsagePercentage = () => {
    const usage = getUsageData();
    return Math.min(100, (usage.count / FREE_TIER_LIMIT) * 100);
  };

  const resetUsage = () => {
    const currentMonth = getCurrentMonth();
    localStorage.setItem(STORAGE_KEY, '0');
    localStorage.setItem(MONTH_KEY, currentMonth);
  };

  const isPremiumUser = () => {
    return localStorage.getItem('bhaskara_premium') === 'true';
  };

  const setPremiumStatus = (status) => {
    localStorage.setItem('bhaskara_premium', status.toString());
  };

  return {
    incrementCalculation,
    canCalculate,
    getRemainingCalculations,
    getUsagePercentage,
    isPremiumUser,
    setPremiumStatus,
    resetUsage
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UsageTracker;
}