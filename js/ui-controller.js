const UIController = (() => {
  
  let currentElements = {
    a: 6778,
    e: 0.0001,
    i: 51.6,
    raan: 0,
    argPe: 0,
    trueAnomaly: 0
  };
  
  let currentTrajectory = null;
  let calculationCount = 0;

  const init = () => {
    setupEventListeners();
    loadSavedState();
    populateInputFields();
    updateCalculationCounter();
  };

  const setupEventListeners = () => {
    document.getElementById('calculate-btn')?.addEventListener('click', handleCalculate);
    document.getElementById('animate-btn')?.addEventListener('click', handleAnimate);
    document.getElementById('export-csv-btn')?.addEventListener('click', handleExportCSV);
    document.getElementById('export-png-btn')?.addEventListener('click', handleExportPNG);
    document.getElementById('save-project-btn')?.addEventListener('click', handleSaveProject);
    
    const sliders = document.querySelectorAll('.slider');
    sliders.forEach(slider => {
      slider.addEventListener('input', handleSliderInput);
      slider.addEventListener('change', handleSliderChange);
    });
    
    const inputs = document.querySelectorAll('.input-field');
    inputs.forEach(input => {
      input.addEventListener('change', handleInputChange);
      input.addEventListener('blur', validateInput);
    });

    document.querySelectorAll('.result-card').forEach(card => {
      card.addEventListener('click', handleResultCopy);
    });
  };

  const populateInputFields = () => {
    document.getElementById('input-a').value = currentElements.a;
    document.getElementById('input-e').value = currentElements.e;
    document.getElementById('input-i').value = currentElements.i;
    document.getElementById('input-raan').value = currentElements.raan;
    document.getElementById('input-argpe').value = currentElements.argPe;
    document.getElementById('input-ta').value = currentElements.trueAnomaly;
    
    document.getElementById('slider-a').value = currentElements.a;
    document.getElementById('slider-e').value = currentElements.e;
    document.getElementById('slider-i').value = currentElements.i;
  };

  const handleSliderInput = (event) => {
    const slider = event.target;
    const value = parseFloat(slider.value);
    const param = slider.dataset.param;
    
    const tooltip = slider.parentElement.querySelector('.slider-value-tooltip');
    if (tooltip) {
      const unit = slider.dataset.unit || '';
      tooltip.textContent = `${value.toFixed(param === 'e' ? 4 : 1)} ${unit}`;
      tooltip.style.opacity = '1';
    }
    
    currentElements[param] = value;
    document.getElementById(`input-${param}`).value = value;
    
    if (window.VisualizationEngine && window.VisualizationEngine.updateOrbitPreview) {
      window.VisualizationEngine.updateOrbitPreview(currentElements);
    }
  };

  const handleSliderChange = (event) => {
    const tooltip = event.target.parentElement.querySelector('.slider-value-tooltip');
    if (tooltip) {
      setTimeout(() => { tooltip.style.opacity = '0'; }, 1000);
    }
  };

  const handleInputChange = (event) => {
    const input = event.target;
    const param = input.id.replace('input-', '');
    const value = parseFloat(input.value);
    
    if (!isNaN(value)) {
      currentElements[param] = value;
      const slider = document.getElementById(`slider-${param}`);
      if (slider) slider.value = value;
    }
  };

  const validateInput = (event) => {
    const input = event.target;
    const param = input.id.replace('input-', '');
    const value = parseFloat(input.value);
    
    let isValid = true;
    
    if (param === 'a' && value <= OrbitalMath.CONSTANTS.EARTH_RADIUS) {
      showError(input, 'Semi-major axis must exceed Earth radius (6371 km)');
      isValid = false;
    } else if (param === 'e' && (value < 0 || value >= 1)) {
      showError(input, 'Eccentricity must be between 0 and 1');
      isValid = false;
    } else if ((param === 'i' || param === 'raan' || param === 'argpe' || param === 'ta') && (value < 0 || value >= 360)) {
      showError(input, 'Angle must be between 0° and 360°');
      isValid = false;
    }
    
    if (isValid) {
      input.classList.remove('error');
    }
  };

  const showError = (input, message) => {
    input.classList.add('error');
    showWarningBanner(message);
    
    setTimeout(() => {
      input.classList.remove('error');
    }, 2000);
  };

  const handleCalculate = async () => {
    const btn = document.getElementById('calculate-btn');
    if (btn.classList.contains('loading')) return;
    
    const validation = OrbitalMath.validateOrbitalElements(currentElements);
    if (!validation.valid) {
      showWarningBanner(validation.errors.join('. '));
      return;
    }
    
    if (!UsageTracker.canCalculate()) {
      showWarningBanner('⚠️ Monthly calculation limit reached. Upgrade to Premium for unlimited calculations.');
      return;
    }
    
    btn.classList.add('loading');
    btn.textContent = 'Calculating...';
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      const period = OrbitalMath.calculateOrbitalPeriod(currentElements.a);
      const { apogee, perigee } = OrbitalMath.calculateApogeePerigee(currentElements.a, currentElements.e);
      const { vApogee, vPerigee } = OrbitalMath.calculateVelocities(currentElements.a, currentElements.e);
      
      currentTrajectory = OrbitalMath.propagateOrbitRK4(currentElements, period, period / 100);
      
      displayResults({
        period: period / 60,
        apogee,
        perigee,
        vApogee,
        vPerigee
      });
      
      const stability = OrbitalMath.getOrbitStability(perigee);
      updateStabilityIndicator(stability, perigee);
      
      if (window.VisualizationEngine && window.VisualizationEngine.renderOrbit) {
        window.VisualizationEngine.renderOrbit(currentElements, currentTrajectory);
      }
      
      UsageTracker.incrementCalculation();
      updateCalculationCounter();
      
      createRippleEffect(btn);
      
    } catch (error) {
      console.error('Calculation error:', error);
      showWarningBanner('❌ Calculation failed. Please check your inputs.');
    } finally {
      btn.classList.remove('loading');
      btn.textContent = 'Calculate';
    }
  };

  const displayResults = (results) => {
    const resultsSection = document.querySelector('.results-section');
    if (!resultsSection) return;
    
    resultsSection.innerHTML = '';
    
    const resultCards = [
      { label: 'Orbital Period', value: results.period.toFixed(2), unit: 'min' },
      { label: 'Apogee Altitude', value: results.apogee.toFixed(1), unit: 'km' },
      { label: 'Perigee Altitude', value: results.perigee.toFixed(1), unit: 'km' },
      { label: 'Velocity at Apogee', value: results.vApogee.toFixed(2), unit: 'km/s' },
      { label: 'Velocity at Perigee', value: results.vPerigee.toFixed(2), unit: 'km/s' }
    ];
    
    resultCards.forEach((card, index) => {
      const cardElement = document.createElement('div');
      cardElement.className = 'result-card';
      cardElement.style.animationDelay = `${index * 100}ms`;
      cardElement.dataset.value = `${card.value} ${card.unit}`;
      
      cardElement.innerHTML = `
        <div class="result-label">${card.label}</div>
        <div class="result-value">${card.value}<span class="result-unit">${card.unit}</span></div>
      `;
      
      resultsSection.appendChild(cardElement);
    });
    
    document.querySelectorAll('.result-card').forEach(card => {
      card.addEventListener('click', handleResultCopy);
    });
  };

  const updateStabilityIndicator = (stability, perigee) => {
    const indicator = document.querySelector('.orbit-stability-indicator');
    if (!indicator) return;
    
    indicator.className = `orbit-stability-indicator ${stability}`;
    
    const messages = {
      stable: `✓ Stable Orbit (Perigee: ${perigee.toFixed(1)} km)`,
      marginal: `⚠ Marginal Orbit (Perigee: ${perigee.toFixed(1)} km, ~months lifespan)`,
      decay: `⚠️ Decay Orbit (Perigee: ${perigee.toFixed(1)} km, ~days to reentry)`
    };
    
    indicator.textContent = messages[stability];
  };

  const handleAnimate = () => {
    if (!currentTrajectory) {
      showWarningBanner('⚠️ Calculate orbit first before animating');
      return;
    }
    
    if (window.VisualizationEngine && window.VisualizationEngine.animateOrbit) {
      window.VisualizationEngine.animateOrbit(currentTrajectory);
    }
  };

  const handleExportCSV = () => {
    if (!currentTrajectory) {
      showWarningBanner('⚠️ No trajectory data to export');
      return;
    }
    
    let csv = 'Time (s),X (km),Y (km),Z (km),Vx (km/s),Vy (km/s),Vz (km/s)\n';
    
    currentTrajectory.forEach(point => {
      csv += `${point.time.toFixed(2)},`;
      csv += `${point.position.x.toFixed(6)},${point.position.y.toFixed(6)},${point.position.z.toFixed(6)},`;
      csv += `${point.velocity.x.toFixed(6)},${point.velocity.y.toFixed(6)},${point.velocity.z.toFixed(6)}\n`;
    });
    
    downloadFile(csv, 'orbit_trajectory.csv', 'text/csv');
    
    createRippleEffect(document.getElementById('export-csv-btn'));
  };

  const handleExportPNG = () => {
    if (window.VisualizationEngine && window.VisualizationEngine.exportScreenshot) {
      window.VisualizationEngine.exportScreenshot();
      createRippleEffect(document.getElementById('export-png-btn'));
    } else {
      showWarningBanner('⚠️ Visualization not ready');
    }
  };

  const handleSaveProject = () => {
    const projectName = prompt('Enter project name:', `Orbit_${Date.now()}`);
    if (!projectName) return;
    
    const project = {
      name: projectName,
      timestamp: new Date().toISOString(),
      elements: currentElements,
      trajectory: currentTrajectory
    };
    
    const projects = JSON.parse(localStorage.getItem('bhaskara_projects') || '[]');
    
    if (projects.length >= 3) {
      showWarningBanner('⚠️ Free tier allows 3 saved projects. Upgrade to Premium for unlimited cloud storage.');
      return;
    }
    
    projects.push(project);
    localStorage.setItem('bhaskara_projects', JSON.stringify(projects));
    
    showWarningBanner(`✓ Project "${projectName}" saved successfully`, 'success');
  };

  const handleResultCopy = (event) => {
    const card = event.currentTarget;
    const value = card.dataset.value;
    
    navigator.clipboard.writeText(value).then(() => {
      createRippleEffect(card, event);
      showWarningBanner('✓ Copied to clipboard', 'success');
    });
  };

  const createRippleEffect = (element, event = null) => {
    const ripple = document.createElement('span');
    ripple.className = 'ripple-effect';
    
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    
    if (event) {
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
    } else {
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${rect.width / 2 - size / 2}px`;
      ripple.style.top = `${rect.height / 2 - size / 2}px`;
    }
    
    element.style.position = 'relative';
    element.appendChild(ripple);
    
    setTimeout(() => ripple.remove(), 600);
  };

  const showWarningBanner = (message, type = 'warning') => {
    let banner = document.querySelector('.warning-banner');
    
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'warning-banner';
      document.body.appendChild(banner);
    }
    
    banner.textContent = message;
    banner.style.background = type === 'success' ? 'var(--color-orbit-stable)' : 'var(--color-accent-magenta)';
    banner.classList.add('show');
    
    setTimeout(() => {
      banner.classList.remove('show');
    }, 3000);
  };

  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const loadSavedState = () => {
    const saved = localStorage.getItem('bhaskara_last_elements');
    if (saved) {
      try {
        currentElements = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to load saved state:', e);
      }
    }
  };

  const saveState = () => {
    localStorage.setItem('bhaskara_last_elements', JSON.stringify(currentElements));
  };

  const updateCalculationCounter = () => {
    const counter = document.querySelector('.calculation-counter');
    if (counter) {
      const remaining = UsageTracker.getRemainingCalculations();
      counter.textContent = `${remaining} calculations remaining this month`;
    }
  };

  window.addEventListener('beforeunload', saveState);

  return {
    init,
    getCurrentElements: () => currentElements,
    getCurrentTrajectory: () => currentTrajectory
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIController;
}