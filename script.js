console.log("script.js starting to load - STEP 3: Add Tunnel");

// --- Global Variables ---
let scene, camera, renderer, world;
let groundMesh, groundBody;
let tunnelMesh; // Removed tunnelBody reference as it's not used
let outerTunnelMesh; // Added for outer tunnel
let secondLargeTunnelMesh; // Added for the new 2x2 tunnel
let thirdTunnelMesh; // For the new 1m x 2m tunnel
let blastDoorMesh, blastDoorBody; // Added for blast door
let secondBlastDoorMesh, secondBlastDoorBody; // Added for the second blast door
let thirdBlastDoorMesh, thirdBlastDoorBody; // For the third blast door
let firstBlastDoorLeftWallBody, secondBlastDoorLeftWallBody, secondBlastDoorRightWallBody;
let thirdBlastDoorLeftWallBody, thirdBlastDoorRightWallBody; // Walls for the third blast door
let robotMesh, robotBody;
let robotVehicle; // Added for vehicle physics
let craneBody, cranetipBody; // Added for crane physics bodies
let rightWallBody; // <<< Make right wall body global for debugging (This is for the FIRST door's right wall)
let clock = new THREE.Clock();
let clippingPlane;
let planeHelper;
let orbitControls; // <<< Added for camera controls

// Robot leg animation state
let legL, legR; // References to leg objects
let legLB, legRB; // <<< Added Back Legs
let crane, cranetip, crane001; // <<< Added Crane parts (crane = boom_main, crane001 = new joint)
let legsFolded = false; // Toggle state (for all legs)
let craneFolded = false; // <<< Added Crane fold state
let cranetipFolded = false; // <<< Added Cranetip fold state
let crane001Folded = false; // <<< Added Crane.001 fold state

// Added crane control variables
let craneAngle = 0; // Current rotation angle for main crane (boom_main)
let cranetipAngle = 0; // Current rotation angle for cranetip
let crane001Angle = 0; // Current rotation angle for crane.001
const craneRotationSpeed = 0.5; // Radians per second

// Crane physics dimensions
const CRANE_LENGTH = 0.8; // Length of crane arm
const CRANE_WIDTH = 0.15; // Width of crane arm
const CRANE_HEIGHT = 0.15; // Height of crane arm
const CRANETIP_LENGTH = 0.5; // Length of cranetip
const CRANETIP_WIDTH = 0.1; // Width of cranetip
const CRANETIP_HEIGHT = 0.1; // Height of cranetip

// Materials for physics
let concreteMaterial;
let robotMaterial, groundRobotContactMaterial;
let tunnelRobotContactMaterial;

// Robot constants - Re-enabled
// Updated dimensions based on feet-to-meters conversion (1ft ~ 0.3048m)
const ROBOT_WIDTH = 0.6; // ~4ft
const ROBOT_LENGTH = 1.52; // ~5ft
const ROBOT_HEIGHT = 1.3; // ~5.5ft 
const ROBOT_MASS = 1200; // Increased mass from 560 to help stability
const segmentLength = 4; // Access segmentLength here for calculation
// Adjusted Y position slightly higher to prevent sinking, using NEW ROBOT_HEIGHT
// Moved Z position further back from tunnel entrance
const ROBOT_START_POS = new THREE.Vector3(-0.5, ROBOT_HEIGHT / 2 + 0.5, (segmentLength / 2) + 56); // <<< Adjusted Z offset closer to entrance AND moved left slightly

// --- Control variables - Re-enabled ---
const controls = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    arrowUp: false,    // <<< Added for camera control
    arrowDown: false,  // <<< Added for camera control
    arrowLeft: false,  // <<< Added for camera control
    arrowRight: false, // <<< Added for camera control
    craneUp: false,    // <<< Added for crane control (I key)
    craneDown: false,  // <<< Added for crane control (K key)
    crane001Up: false,   // <<< Added for crane.001 control (7 key)
    crane001Down: false  // <<< Added for crane.001 control (6 key)
};
const moveForce = 30000; // <<< Increased force to overcome static friction
const turnSpeed = 1.0; // <<< Added turnSpeed (radians/second)

// ------------------------------------------------------------------
//  QUICK-DEBUG FLAGS  – set to false in console & reload to isolate jitter source
// ------------------------------------------------------------------
const DEBUG_CRANE_PHYSICS      = true;   // disables crane + cranetip physics bodies
const DEBUG_CRANE_BODY_UPDATE  = true;   // disables per-frame kinematic updates of crane bodies
const DEBUG_RAYCAST_VEHICLE    = true;   // disables RaycastVehicle creation & control
const DEBUG_TUNNEL_BOX_PHYSICS = true;   // disables inner tunnel physics boxes
const DEBUG_OUTER_TUNNEL_BOXES = true;   // disables outer tunnel physics boxes
// ------------------------------------------------------------------

// --- Initialization ---
function init() {
    console.log("init() function started - STEP 8: Adjust Clipping & Add OrbitControls.");
    
    // Three.js Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xaaaaaa);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(ROBOT_START_POS.x, ROBOT_START_POS.y + 2, ROBOT_START_POS.z + 3);
    // camera.lookAt(ROBOT_START_POS); // OrbitControls will manage the target

    // Renderer - Re-enable clipping
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('simulationCanvas'), antialias: true });
    if (!renderer.domElement) {
        console.error("Failed to create WebGLRenderer or get canvas element!");
        return;
    }
    console.log("Renderer created with canvas:", renderer.domElement);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.localClippingEnabled = true; // <<< Re-enable
    renderer.outputEncoding = THREE.sRGBEncoding; // <<< Add color encoding
    console.log("Renderer clipping RE-ENABLED.");

    // --- Orbit Controls --- 
    orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
    orbitControls.target.set(ROBOT_START_POS.x, ROBOT_START_POS.y, ROBOT_START_POS.z); // Look at robot initially
    orbitControls.enableDamping = true; // Optional: smooths camera movement
    orbitControls.dampingFactor = 0.1;
    console.log("OrbitControls initialized.");

    // Lighting (Simple)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); 
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    scene.add(directionalLight);

    // Cannon.js World - Re-enabled
    world = new CANNON.World();
    world.gravity.set(0, -9.81, 0);
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.solver.iterations = 50; // Increased solver iterations
    world.allowSleep = true; // Allow bodies to sleep
    world.defaultContactMaterial.contactEquationStiffness = 1e7;
    world.defaultContactMaterial.contactEquationRelaxation = 4;
    console.log("Cannon.js world created.");

    // --- Adjust Clipping Plane --- 
    const clipHeight = 2.5; // <<< Raise clip plane to 2.5m (above outer tunnel height of 2.0m)
    clippingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), clipHeight); 
    renderer.clippingPlanes = [clippingPlane]; 
    console.log(`Clipping plane assigned at y = ${clipHeight}.`);

    // Optional: Visualize the plane
    planeHelper = new THREE.PlaneHelper(clippingPlane, 10, 0xff0000); 
    scene.add(planeHelper);
    console.log("Clipping plane helper added to scene.");

    // Setup materials - Re-enabled (more materials)
    setupMaterials();

    // Ground Plane - Re-enabled
    createGround();
    console.log("Ground created.");

    // Tunnel - Re-enabled
    createTunnel();
    console.log("Tunnel creation requested.");

    // Create Outer Tunnel
    createOuterTunnel();
    console.log("Outer tunnel creation requested.");

    // Create Second Large Tunnel
    createSecondLargeTunnel();
    console.log("Second large tunnel creation requested.");

    // Create Blast Door in Outer Tunnel
    createBlastDoor();
    console.log("Blast door created in outer tunnel.");

    // Create Blast Door for the Second Large Tunnel
    const newTunnelCenterForBlastDoor = 6.35; // Must match horizontalOffset_New in createSecondLargeTunnel
    const secondTunnelWidthForBlastDoor = 2.0; // Width of the second large tunnel
    createBlastDoorForSecondTunnel(newTunnelCenterForBlastDoor, secondTunnelWidthForBlastDoor);
    console.log("Blast door for second large tunnel created.");

    // Create Third Large Tunnel
    createThirdTunnel();
    console.log("Third large tunnel creation requested.");

    // Create Blast Door for the Third Large Tunnel
    const thirdTunnelCenterForBlastDoor = 12.85; // Must match horizontalOffset_New in createThirdTunnel
    const thirdTunnelWidthForBlastDoor = 1.0; // Width of the third large tunnel
    createBlastDoorForThirdTunnel(thirdTunnelCenterForBlastDoor, thirdTunnelWidthForBlastDoor);
    console.log("Blast door for third large tunnel created.");

    // Robot - Re-enabled
    createRobot();
    console.log("Robot created.");

    // Create Obstacles
    createObstacles();
    console.log("Obstacles created.");

    // Create Scaled Obstacles for the Second Large Tunnel
    const newTunnelCenterXinInit = 6.35; // CenterX of the second large tunnel
    createScaledObstaclesForSecondTunnel(newTunnelCenterXinInit);
    console.log("Scaled obstacles for second large tunnel created.");

    // Create Scaled Obstacles for the Third Large Tunnel
    const thirdTunnelCenterXinInit = 12.85; // CenterX of the third large tunnel
    createScaledObstaclesForThirdTunnel(thirdTunnelCenterXinInit);
    console.log("Scaled obstacles for third large tunnel created.");

    // Setup Controls - Re-enabled
    setupControls(); 
    console.log("Controls setup.");

    // Event Listeners
    window.addEventListener('resize', onWindowResize, false);

    // Start Animation Loop
    animate();
    console.log("STEP 8 init() finished, starting animation loop.");

    // Add logo to screen
    addLogoToScreen();

    // Create Teleport Button
    createTeleportButton();
}

// --- Add Logo to Screen ---
function addLogoToScreen() {
    console.log("addLogoToScreen() called.");
    const logoImg = document.createElement('img');
    logoImg.src = 'TRAYSAR-Black-Logo.png'; // The path to your logo
    logoImg.alt = 'TRAYSAR Logo';
    logoImg.style.position = 'absolute';
    logoImg.style.top = '20px';
    logoImg.style.right = '20px';
    logoImg.style.width = '150px'; // Adjust size as needed
    logoImg.style.zIndex = '1000'; // Ensure it's on top of other elements
    logoImg.style.backgroundColor = 'rgba(255, 255, 255, 0.7)'; // Optional: slight white background for visibility
    logoImg.style.padding = '5px'; // Optional: padding around the logo
    logoImg.style.borderRadius = '5px'; // Optional: rounded corners

    document.body.appendChild(logoImg);
    console.log("Logo image added to the screen.");
}

// --- Create Teleport Button ---
function createTeleportButton() {
    console.log("createTeleportButton() called.");
    const button = document.createElement('button');
    button.innerHTML = '&#x1F9ED;'; // Compass icon (🧭)
    button.style.position = 'absolute';
    button.style.top = '20px'; // Position from the top
    button.style.left = '20px'; // Position from the left
    button.style.width = '50px';
    button.style.height = '50px';
    button.style.fontSize = '24px'; // Adjust if icon needs different sizing
    button.style.zIndex = '1000';
    button.style.backgroundColor = 'rgba(200, 200, 200, 0.8)';
    button.style.border = '1px solid black';
    button.style.cursor = 'pointer';

    button.addEventListener('click', () => {
        if (robotBody) {
            console.log("Teleport button clicked. Teleporting robot to second tunnel entrance.");

            const segmentLength = 4; // Global variable
            const ROBOT_HEIGHT = 1.3; // Global variable
            const horizontalOffset_New = 6.35; // CenterX of the second tunnel

            const targetX = horizontalOffset_New;
            const targetY = ROBOT_HEIGHT / 2 + 0.5; // Consistent with ROBOT_START_POS.y calculation
            const targetZ = (segmentLength / 2) + 55; // Start Z of the second tunnel path

            robotBody.position.set(targetX, targetY, targetZ);
            robotBody.velocity.set(0, 0, 0);
            robotBody.angularVelocity.set(0, 0, 0);

            // Set orientation to face into the tunnel (-Z direction)
            const initialRotation = new CANNON.Quaternion();
            initialRotation.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI);
            robotBody.quaternion.copy(initialRotation);
            
            robotBody.wakeUp();

            // If using OrbitControls and wanting it to re-target the robot
            if (orbitControls) {
                orbitControls.target.copy(robotBody.position);
                // If camera is far, might want to snap it closer or behind the robot
                // camera.position.set(targetX, targetY + 2, targetZ + 3); // Example repositioning
                orbitControls.update();
            }

            console.log(`Robot teleported to X:${targetX.toFixed(2)}, Y:${targetY.toFixed(2)}, Z:${targetZ.toFixed(2)}`);
        } else {
            console.warn("Teleport button: robotBody not found!");
        }
    });

    document.body.appendChild(button);
    console.log("Teleport button added to the screen.");
}

// --- Create Teleport Button for Tunnel 3 ---
function createTeleportButtonTunnel3() {
    console.log("createTeleportButtonTunnel3() called.");
    const button = document.createElement('button');
    button.innerHTML = 'T3'; // Label for the third tunnel teleport
    button.style.position = 'absolute';
    button.style.top = '80px'; // Position below the compass button (compass top is 20px + ~50px height)
    button.style.left = '20px';
    button.style.width = '50px';
    button.style.height = '50px';
    button.style.fontSize = '24px';
    button.style.zIndex = '1000';
    button.style.backgroundColor = 'rgba(200, 200, 200, 0.8)';
    button.style.border = '1px solid black';
    button.style.cursor = 'pointer';

    button.addEventListener('click', () => {
        if (robotBody) {
            console.log("Teleport button (T3) clicked. Teleporting robot to third tunnel entrance.");

            const segmentLength = 4; // Global variable
            const ROBOT_HEIGHT = 1.3; // Global variable
            const thirdTunnelCenterX = 12.85; // X center of the third tunnel

            const targetX = thirdTunnelCenterX;
            const targetY = ROBOT_HEIGHT / 2 + 0.5; 
            const targetZ = (segmentLength / 2) + 55; // Start Z of the tunnel path

            robotBody.position.set(targetX, targetY, targetZ);
            robotBody.velocity.set(0, 0, 0);
            robotBody.angularVelocity.set(0, 0, 0);

            const initialRotation = new CANNON.Quaternion();
            initialRotation.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI);
            robotBody.quaternion.copy(initialRotation);
            
            robotBody.wakeUp();

            if (orbitControls) {
                orbitControls.target.copy(robotBody.position);
                orbitControls.update();
            }

            console.log(`Robot teleported to third tunnel at X:${targetX.toFixed(2)}, Y:${targetY.toFixed(2)}, Z:${targetZ.toFixed(2)}`);
        } else {
            console.warn("Teleport button (T3): robotBody not found!");
        }
    });

    document.body.appendChild(button);
    console.log("Teleport button (T3) added to the screen.");
}

// Re-enabled (more materials)
function setupMaterials() { 
    console.log("setupMaterials() called.");
    concreteMaterial = new CANNON.Material("concrete");
    robotMaterial = new CANNON.Material("robot");
    
    // Contact between ground (concrete) and robot - Enhanced friction for better tracking
    groundRobotContactMaterial = new CANNON.ContactMaterial(
        concreteMaterial,    // Ground
        robotMaterial,        // Robot
        {
            friction: 0.9,    // Increased friction for better tracking on ground (from 0.25)
            restitution: 0.0, // No bounce
            contactEquationStiffness: 5e7, // Decreased stiffness
            contactEquationRelaxation: 4,  // Increased relaxation
            frictionEquationStiffness: 5e7, // Decreased stiffness
            frictionEquationRegularizationTime: 3,
        }
    );
    world.addContactMaterial(groundRobotContactMaterial);
    console.log("Ground-Robot contact material updated with higher friction for improved tracking");

    // Contact between tunnel walls (concrete) and robot - Re-enabled
    tunnelRobotContactMaterial = new CANNON.ContactMaterial(
        concreteMaterial, // Tunnel wall/ceiling (using same concrete material)
        robotMaterial,    // Robot
        {
            friction: 0.1, // <<< Reduced friction for scraping walls (from 0.3)
            restitution: 0.2 // A bit more bounce off walls
        }
    );
    world.addContactMaterial(tunnelRobotContactMaterial);
    console.log("Tunnel-Robot contact material added (Reduced FRICTION).");
    
    console.log("Materials setup finished.");
} 

// Re-enabled
function createGround() { 
    console.log("createGround() called.");
    const groundGeometry = new THREE.PlaneGeometry(150, 150);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x777777, 
        side: THREE.DoubleSide
    });
    groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.01;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const groundShape = new CANNON.Plane();
    groundBody = new CANNON.Body({ mass: 0, material: concreteMaterial });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    groundBody.position.copy(groundMesh.position);
    world.addBody(groundBody);
    console.log("Ground body added to world.");
} 

// --- Tunnel Creation - Using Boxes for Physics ---
function createTunnel() {
    if (!DEBUG_TUNNEL_BOX_PHYSICS) {
        console.warn("DEBUG: Inner tunnel physics disabled via flag");
        return;
    }
    console.log("createTunnel() function executing (Physics with Boxes)...");
    const tunnelWidth = 0.7; // <<< Reverted width to original value (from 1.0)
    const tunnelHeight = 1.5;
    const wallThickness = 0.3; // Thickness for physics boxes

    // Path points define the centerline corners
    const pathPoints = [
        new THREE.Vector3(0, 0, (segmentLength / 2) + 50), // Start - Adjusted for 50m initial length
        new THREE.Vector3(0, 0, segmentLength / 2),      // Corner 1
        new THREE.Vector3(-segmentLength / 2, 0, segmentLength / 2), // Corner 2
        new THREE.Vector3(-segmentLength / 2, 0, -segmentLength / 2), // Corner 3
        new THREE.Vector3(segmentLength / 2, 0, -segmentLength / 2), // Corner 4
        new THREE.Vector3(segmentLength / 2, 0, -segmentLength * 1.5), // Corner 5
        new THREE.Vector3(-segmentLength / 2, 0, -segmentLength * 1.5), // Corner 6
        new THREE.Vector3(-segmentLength / 2, 0, -segmentLength * 2.5) // End
    ];
    // const path = new THREE.CatmullRomCurve3(pathPoints); // Path curve still used for visuals

    // --- Create Visual Mesh (Unchanged) ---
    // Use original detailed geometry for visuals
    const visualSteps = 100; 
    const visualProfilePoints = 20;
    const visualPath = new THREE.CatmullRomCurve3(pathPoints); // Use same path for consistency
    const visualExtrudeSettings = { steps: visualSteps, bevelEnabled: false, extrudePath: visualPath };
    const tunnelVisMaterial = new THREE.MeshStandardMaterial({
        color: 0x696969,    // Sand color for inner tunnel (walls/floor/ceiling)
        roughness: 0.9,     // Sand is typically not shiny
        metalness: 0.0,     // Sand is not metallic
        side: THREE.DoubleSide,
        wireframe: false,
        transparent: true,  // Enable transparency
        opacity: 0.4        // Make it 40% opaque (60% transparent) - same as outer tunnel
    });
    const profilePoints = [];
    profilePoints.push(new THREE.Vector2(-tunnelWidth / 2, 0));
    for (let i = 0; i <= visualProfilePoints; i++) {
        const angle = Math.PI * (1 - i / visualProfilePoints);
        profilePoints.push(new THREE.Vector2(Math.cos(angle) * (tunnelWidth / 2), Math.sin(angle) * (tunnelWidth / 2) + (tunnelHeight - tunnelWidth / 2)));
    }
    profilePoints.push(new THREE.Vector2(tunnelWidth / 2, 0));
    const tunnelVertices = [];
    const tunnelFaces = [];
    const pathSegments = visualExtrudeSettings.steps;
    const frames = visualPath.computeFrenetFrames(pathSegments, false);
    const worldUp = new THREE.Vector3(0, 1, 0); // Define world UP direction
    const rotationMatrix = new THREE.Matrix4();
    const translationMatrix = new THREE.Matrix4();
    const transformationMatrix = new THREE.Matrix4();
    const localVertex = new THREE.Vector3();
    const worldVertex = new THREE.Vector3();

    console.log(`Computing ${pathSegments} path segments using Matrix transformation...`);

    for (let i = 0; i <= pathSegments; i++) {
        const point = visualPath.getPointAt(i / pathSegments);
        const tangent = frames.tangents[i]; // Get tangent for direction
        
        // Calculate local coordinate system axes
        const axisZ = tangent.clone(); // Z points along the path
        const axisX = worldUp.clone().cross(axisZ).normalize(); // X points sideways
        const axisY = axisZ.clone().cross(axisX).normalize(); // Y points truly up

        // Create rotation matrix from axes
        rotationMatrix.makeBasis(axisX, axisY, axisZ);
        // Create translation matrix
        translationMatrix.makeTranslation(point.x, point.y, point.z);
        // Combine into transformation matrix
        transformationMatrix.multiplyMatrices(translationMatrix, rotationMatrix);

        for (let j = 0; j < profilePoints.length; j++) {
            const profilePoint = profilePoints[j]; // 2D point (x=width, y=height)
            
            // Set local vertex position based on profile point
            localVertex.set(profilePoint.x, profilePoint.y, 0); 
            // Apply the transformation matrix to get world position
            worldVertex.copy(localVertex).applyMatrix4(transformationMatrix);

            tunnelVertices.push(worldVertex.x, worldVertex.y, worldVertex.z);
        }
        
        // Face generation (remains the same, uses indices)
        if (i > 0) {
            const baseIdx = (i - 1) * profilePoints.length;
            const currentBaseIdx = i * profilePoints.length;
            for (let j = 0; j < profilePoints.length - 1; j++) {
                const v1 = baseIdx + j; const v2 = baseIdx + j + 1; const v3 = currentBaseIdx + j + 1; const v4 = currentBaseIdx + j;
                tunnelFaces.push(v1, v2, v4); tunnelFaces.push(v2, v3, v4);
            }
        }
    }
    const tunnelGeometry = new THREE.BufferGeometry();
    tunnelGeometry.setAttribute('position', new THREE.Float32BufferAttribute(tunnelVertices, 3));
    tunnelGeometry.setIndex(tunnelFaces);
    tunnelGeometry.computeVertexNormals();
    tunnelMesh = new THREE.Mesh(tunnelGeometry, tunnelVisMaterial);
    tunnelMesh.castShadow = true;
    tunnelMesh.receiveShadow = true;
    scene.add(tunnelMesh);
    console.log("Tunnel VISUAL mesh added to scene.");

    // --- Create Cannon.js Trimesh Body (DISABLED) ---
    console.warn("Tunnel Trimesh PHYSICS BODY creation is DISABLED due to instability.");
    /* ... Trimesh code remains commented out ... */

    // --- Create Cannon.js BOXES for Tunnel Physics ---
    console.log("Creating Tunnel Physics using BOXES...");
    const boxMaterial = concreteMaterial; 
    const tunnelBodies = []; 

    for (let i = 0; i < pathPoints.length - 1; i++) {
        const startPoint = pathPoints[i];
        const endPoint = pathPoints[i+1];
        const segmentVector = endPoint.clone().sub(startPoint);
        const segmentMidpoint = startPoint.clone().add(segmentVector.clone().multiplyScalar(0.5));
        const segmentLengthActual = segmentVector.length();
        
        console.log(`Segment ${i}: Length=${segmentLengthActual.toFixed(2)}`);
        if (segmentLengthActual === 0) {
            console.warn(`Segment ${i} has zero length! Skipping physics box creation.`);
            continue; // Avoid normalizing zero vector
        }

        // Normalize segment vector IN PLACE before using it
        const normalizedSegmentVector = segmentVector.clone(); 
        normalizedSegmentVector.normalize(); 
        console.log(`  Segment ${i}: Normalized segment vector =`, normalizedSegmentVector);

        // --- Floor Box ---
        const floorShape = new CANNON.Box(new CANNON.Vec3(tunnelWidth / 2, wallThickness / 2, segmentLengthActual / 2));
        const floorBody = new CANNON.Body({ mass: 0, material: boxMaterial, shape: floorShape });
        floorBody.position.set(segmentMidpoint.x, -wallThickness / 2, segmentMidpoint.z); 
        
        // --- Calculate Quaternion using Axis-Angle --- 
        const fromVector = new CANNON.Vec3(0, 0, 1); // Default Z-axis direction
        const toVector = normalizedSegmentVector;
        const axis = new CANNON.Vec3();
        fromVector.cross(toVector, axis); // Calculate rotation axis (result in axis)

        if (axis.lengthSquared() < 1e-8) { // Vectors are parallel or anti-parallel
            if (toVector.dot(fromVector) > 0) { // Parallel, angle is 0
                floorBody.quaternion.set(0, 0, 0, 1); // No rotation (identity quaternion)
            } else { // Anti-parallel, angle is 180 degrees
                // Rotate 180 degrees around an arbitrary orthogonal axis (e.g., Y-axis)
                floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI);
            }
        } else { // Normal case: calculate angle and set
            axis.normalize(); // Normalize the rotation axis
            const dot = fromVector.dot(toVector);
            // Clamp dot product using standard Math functions instead of CANNON.Utils
            const clampedDot = Math.max(-1, Math.min(1, dot)); 
            const angle = Math.acos(clampedDot); 
            floorBody.quaternion.setFromAxisAngle(axis, angle);
        }
        console.log(`  Segment ${i}: Calculated Floor Quaternion =`, floorBody.quaternion);
        
        world.addBody(floorBody);
        tunnelBodies.push(floorBody);

        // --- Corrected Wall Position Calculation (Handling normalize()) ---
        const wallShape = new CANNON.Box(new CANNON.Vec3(wallThickness / 2, tunnelHeight / 2, segmentLengthActual / 2));
        
        // Calculate perpendicular vector
        const perpendicularLeft = new CANNON.Vec3(-segmentVector.z, 0, segmentVector.x);
        console.log(`  Segment ${i}: Raw perpendicularLeft =`, perpendicularLeft);
        const originalLength = perpendicularLeft.length(); // Get length before normalizing
        if (originalLength > 0) { // Avoid normalizing zero vector
            perpendicularLeft.normalize(); // Normalize IN PLACE
            console.log(`  Segment ${i}: In-place normalized perpendicularLeft =`, perpendicularLeft); 
        } else {
             console.warn(`  Segment ${i}: perpendicularLeft has zero length before normalization!`);
             continue;
        }

        // perpendicularLeft variable should now hold the normalized Vec3
        if (typeof perpendicularLeft.clone !== 'function') {
             console.error(`  Segment ${i}: perpendicularLeft STILL does NOT have a clone function after in-place normalize! Object is:`, perpendicularLeft);
             continue; // Skip this segment
        }

        const offsetAmount = tunnelWidth / 2 + wallThickness / 2;

        // --- Left Wall Box ---
        const leftWallOffset = perpendicularLeft.clone(); // Clone the now-normalized vector
        leftWallOffset.scale(offsetAmount, leftWallOffset); 
        const leftWallPos = segmentMidpoint.clone().add(leftWallOffset); 
        const leftWallBody = new CANNON.Body({ mass: 0, material: boxMaterial, shape: wallShape });
        leftWallBody.position.set(leftWallPos.x, tunnelHeight / 2, leftWallPos.z);
        leftWallBody.quaternion.copy(floorBody.quaternion); // Copy the calculated quaternion
        world.addBody(leftWallBody);
        tunnelBodies.push(leftWallBody);
        
        // --- Right Wall Box ---
        const rightWallOffset = perpendicularLeft.clone(); // Clone the normalized vector again
        rightWallOffset.scale(-offsetAmount, rightWallOffset); 
        const rightWallPos = segmentMidpoint.clone().add(rightWallOffset); 
        const rightWallBody = new CANNON.Body({ mass: 0, material: boxMaterial, shape: wallShape });
        rightWallBody.position.set(rightWallPos.x, tunnelHeight / 2, rightWallPos.z);
        rightWallBody.quaternion.copy(floorBody.quaternion); // Copy the calculated quaternion 
        world.addBody(rightWallBody);
        tunnelBodies.push(rightWallBody);

        // --- Ceiling Box (Simple flat ceiling approximation) ---
        const ceilingShape = new CANNON.Box(new CANNON.Vec3(tunnelWidth / 2 + wallThickness, wallThickness / 2, segmentLengthActual / 2)); 
        const ceilingBody = new CANNON.Body({ mass: 0, material: boxMaterial, shape: ceilingShape });
        ceilingBody.position.set(segmentMidpoint.x, tunnelHeight + wallThickness / 2, segmentMidpoint.z); 
        ceilingBody.quaternion.copy(floorBody.quaternion); // Copy the calculated quaternion 
        world.addBody(ceilingBody);
        tunnelBodies.push(ceilingBody);
    }
    console.log(`Created ${tunnelBodies.length} physics boxes for the tunnel.`);

    // Note: This doesn't handle the curved arch precisely or fill corner gaps.
    // It provides basic rectangular bounds for each segment.

    console.log("createTunnel() finished (Physics with Boxes).");
}

// --- Outer Tunnel Creation ---
function createOuterTunnel() {
    if (!DEBUG_OUTER_TUNNEL_BOXES) {
        console.warn("DEBUG: Outer tunnel physics disabled via flag");
        return;
    }
    console.log("createOuterTunnel() function executing...");
    const outerTunnelWidth = 2.0; // 2m wide
    const outerTunnelHeight = 2.0; // 2m tall
    const wallThickness = 0.1; // Thickness for physics boxes
    
    // Calculate offset to align right walls
    // Inner tunnel is 0.7m wide, outer is 2.0m wide
    // Offset = (outerWidth - innerWidth) / 2 = (2.0 - 0.7) / 2 = 0.65m
    const horizontalOffset = -0.65; // Negative to move left
    console.log(`Applying horizontal offset of ${horizontalOffset}m to outer tunnel to align right walls`);

    // Path points define the centerline corners, starting 5m before inner tunnel
    // Each point is offset horizontally to align the right walls
    const pathPoints = [
        new THREE.Vector3(horizontalOffset, 0, (segmentLength / 2) + 55), // Start - 5m before inner tunnel
        new THREE.Vector3(horizontalOffset, 0, (segmentLength / 2) + 50), // Match inner tunnel start
        new THREE.Vector3(horizontalOffset, 0, segmentLength / 2),      // Corner 1
        new THREE.Vector3(-segmentLength / 2 + horizontalOffset, 0, segmentLength / 2), // Corner 2
        new THREE.Vector3(-segmentLength / 2 + horizontalOffset, 0, -segmentLength / 2), // Corner 3
        new THREE.Vector3(segmentLength / 2 + horizontalOffset, 0, -segmentLength / 2), // Corner 4
        new THREE.Vector3(segmentLength / 2 + horizontalOffset, 0, -segmentLength * 1.5), // Corner 5
        new THREE.Vector3(-segmentLength / 2 + horizontalOffset, 0, -segmentLength * 1.5), // Corner 6
        new THREE.Vector3(-segmentLength / 2 + horizontalOffset, 0, -segmentLength * 2.5) // End
    ];

    // --- Create Visual Mesh ---
    const visualSteps = 100; 
    const visualProfilePoints = 20;
    const visualPath = new THREE.CatmullRomCurve3(pathPoints);
    const visualExtrudeSettings = { steps: visualSteps, bevelEnabled: false, extrudePath: visualPath };
    const tunnelVisMaterial = new THREE.MeshStandardMaterial({
        color: 0x777777, // Light gray
        side: THREE.DoubleSide,
        wireframe: false,
        transparent: true,
        opacity: 0.1 // Make it semi-transparent to see inner tunnel
    });
    
    // Create a rectangular profile instead of arched one
    const profilePoints = [];
    // Define the 4 corners of the rectangle (counterclockwise from bottom left)
    profilePoints.push(new THREE.Vector2(-outerTunnelWidth / 2, 0)); // Bottom left
    profilePoints.push(new THREE.Vector2(-outerTunnelWidth / 2, outerTunnelHeight)); // Top left
    profilePoints.push(new THREE.Vector2(outerTunnelWidth / 2, outerTunnelHeight)); // Top right
    profilePoints.push(new THREE.Vector2(outerTunnelWidth / 2, 0)); // Bottom right
    // Close the shape by returning to first point
    profilePoints.push(new THREE.Vector2(-outerTunnelWidth / 2, 0)); // Back to bottom left
    
    console.log("Created rectangular profile for outer tunnel with 4 corners");
    
    const tunnelVertices = [];
    const tunnelFaces = [];
    const pathSegments = visualExtrudeSettings.steps;
    const frames = visualPath.computeFrenetFrames(pathSegments, false);
    const worldUp = new THREE.Vector3(0, 1, 0);
    const rotationMatrix = new THREE.Matrix4();
    const translationMatrix = new THREE.Matrix4();
    const transformationMatrix = new THREE.Matrix4();
    const localVertex = new THREE.Vector3();
    const worldVertex = new THREE.Vector3();

    console.log(`Computing ${pathSegments} path segments for outer tunnel...`);

    for (let i = 0; i <= pathSegments; i++) {
        const point = visualPath.getPointAt(i / pathSegments);
        const tangent = frames.tangents[i];
        
        const axisZ = tangent.clone();
        const axisX = worldUp.clone().cross(axisZ).normalize();
        const axisY = axisZ.clone().cross(axisX).normalize();

        rotationMatrix.makeBasis(axisX, axisY, axisZ);
        translationMatrix.makeTranslation(point.x, point.y, point.z);
        transformationMatrix.multiplyMatrices(translationMatrix, rotationMatrix);

        for (let j = 0; j < profilePoints.length; j++) {
            const profilePoint = profilePoints[j];
            localVertex.set(profilePoint.x, profilePoint.y, 0);
            worldVertex.copy(localVertex).applyMatrix4(transformationMatrix);
            tunnelVertices.push(worldVertex.x, worldVertex.y, worldVertex.z);
        }
        
        if (i > 0) {
            const baseIdx = (i - 1) * profilePoints.length;
            const currentBaseIdx = i * profilePoints.length;
            for (let j = 0; j < profilePoints.length - 1; j++) {
                const v1 = baseIdx + j; const v2 = baseIdx + j + 1; 
                const v3 = currentBaseIdx + j + 1; const v4 = currentBaseIdx + j;
                tunnelFaces.push(v1, v2, v4); tunnelFaces.push(v2, v3, v4);
            }
        }
    }
    
    const tunnelGeometry = new THREE.BufferGeometry();
    tunnelGeometry.setAttribute('position', new THREE.Float32BufferAttribute(tunnelVertices, 3));
    tunnelGeometry.setIndex(tunnelFaces);
    tunnelGeometry.computeVertexNormals();
    outerTunnelMesh = new THREE.Mesh(tunnelGeometry, tunnelVisMaterial);
    outerTunnelMesh.castShadow = true;
    outerTunnelMesh.receiveShadow = true;
    scene.add(outerTunnelMesh);
    console.log("Outer tunnel VISUAL mesh added to scene.");

    // --- Create Cannon.js BOXES for Outer Tunnel Physics ---
    console.log("Creating Outer Tunnel Physics using BOXES...");
    const boxMaterial = concreteMaterial; 
    const tunnelBodies = []; 

    for (let i = 0; i < pathPoints.length - 1; i++) {
        const startPoint = pathPoints[i];
        const endPoint = pathPoints[i+1];
        const segmentVector = endPoint.clone().sub(startPoint);
        const segmentMidpoint = startPoint.clone().add(segmentVector.clone().multiplyScalar(0.5));
        const segmentLengthActual = segmentVector.length();
        
        console.log(`Outer Tunnel Segment ${i}: Length=${segmentLengthActual.toFixed(2)}`);
        if (segmentLengthActual === 0) {
            console.warn(`Outer Tunnel Segment ${i} has zero length! Skipping physics box creation.`);
            continue;
        }

        const normalizedSegmentVector = segmentVector.clone(); 
        normalizedSegmentVector.normalize(); 

        // --- Floor Box ---
        const floorShape = new CANNON.Box(new CANNON.Vec3(outerTunnelWidth / 2, wallThickness / 2, segmentLengthActual / 2));
        const floorBody = new CANNON.Body({ mass: 0, material: boxMaterial, shape: floorShape });
        floorBody.position.set(segmentMidpoint.x, -wallThickness / 2, segmentMidpoint.z); 
        
        // --- Calculate Quaternion using Axis-Angle --- 
        const fromVector = new CANNON.Vec3(0, 0, 1);
        const toVector = normalizedSegmentVector;
        const axis = new CANNON.Vec3();
        fromVector.cross(toVector, axis);

        if (axis.lengthSquared() < 1e-8) {
            if (toVector.dot(fromVector) > 0) {
                floorBody.quaternion.set(0, 0, 0, 1);
            } else {
                floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI);
            }
        } else {
            axis.normalize();
            const dot = fromVector.dot(toVector);
            const clampedDot = Math.max(-1, Math.min(1, dot)); 
            const angle = Math.acos(clampedDot); 
            floorBody.quaternion.setFromAxisAngle(axis, angle);
        }
        
        world.addBody(floorBody);
        tunnelBodies.push(floorBody);

        // --- Wall Calculations ---
        const wallShape = new CANNON.Box(new CANNON.Vec3(wallThickness / 2, outerTunnelHeight / 2, segmentLengthActual / 2));
        
        const perpendicularLeft = new CANNON.Vec3(-segmentVector.z, 0, segmentVector.x);
        const originalLength = perpendicularLeft.length();
        if (originalLength > 0) {
            perpendicularLeft.normalize();
        } else {
            console.warn(`Outer Tunnel Segment ${i}: perpendicularLeft has zero length!`);
            continue;
        }

        const offsetAmount = outerTunnelWidth / 2 + wallThickness / 2;

        // --- Left Wall Box ---
        const leftWallOffset = perpendicularLeft.clone();
        leftWallOffset.scale(offsetAmount, leftWallOffset); 
        const leftWallPos = segmentMidpoint.clone().add(leftWallOffset); 
        const leftWallBody = new CANNON.Body({ mass: 0, material: boxMaterial, shape: wallShape });
        leftWallBody.position.set(leftWallPos.x, outerTunnelHeight / 2, leftWallPos.z);
        leftWallBody.quaternion.copy(floorBody.quaternion);
        world.addBody(leftWallBody);
        tunnelBodies.push(leftWallBody);
        
        // --- Right Wall Box ---
        const rightWallOffset = perpendicularLeft.clone();
        rightWallOffset.scale(-offsetAmount, rightWallOffset); 
        const rightWallPos = segmentMidpoint.clone().add(rightWallOffset); 
        const rightWallBody = new CANNON.Body({ mass: 0, material: boxMaterial, shape: wallShape });
        rightWallBody.position.set(rightWallPos.x, outerTunnelHeight / 2, rightWallPos.z);
        rightWallBody.quaternion.copy(floorBody.quaternion);
        world.addBody(rightWallBody);
        tunnelBodies.push(rightWallBody);

        // --- Ceiling Box ---
        const ceilingShape = new CANNON.Box(new CANNON.Vec3(outerTunnelWidth / 2 + wallThickness, wallThickness / 2, segmentLengthActual / 2)); 
        const ceilingBody = new CANNON.Body({ mass: 0, material: boxMaterial, shape: ceilingShape });
        ceilingBody.position.set(segmentMidpoint.x, outerTunnelHeight + wallThickness / 2, segmentMidpoint.z); 
        ceilingBody.quaternion.copy(floorBody.quaternion);
        world.addBody(ceilingBody);
        tunnelBodies.push(ceilingBody);
    }
    console.log(`Created ${tunnelBodies.length} physics boxes for the outer tunnel.`);

    console.log("createOuterTunnel() finished.");
}

// --- Second Large Tunnel Creation (2x2, next to original outer tunnel) ---
function createSecondLargeTunnel() {
    // This debug flag could be specific if needed, for now uses outer tunnel's
    if (!DEBUG_OUTER_TUNNEL_BOXES) { 
        console.warn("DEBUG: Second large tunnel physics disabled (using DEBUG_OUTER_TUNNEL_BOXES flag)");
        return;
    }
    console.log("createSecondLargeTunnel() function executing...");
    const newTunnelWidth = 2.0; 
    const newTunnelHeight = 2.0; 
    const wallThickness = 0.1; // Thickness for physics boxes (can be same as outer)

    // Calculate new horizontal offset to place it to the right of the original outer tunnel
    // Original outer tunnel: width 2.0, center at horizontalOffset -0.65. Right edge = -0.65 + 1.0 = 0.35
    // Gap: 5.0m
    // New tunnel left edge: 0.35 + 5.0 = 5.35
    // New tunnel center (horizontalOffset_New): 5.35 + (newTunnelWidth / 2) = 5.35 + 1.0 = 6.35
    const horizontalOffset_New = 6.35; 
    console.log(`Applying horizontal offset of ${horizontalOffset_New}m to the second large tunnel.`);

    // Path points define the centerline corners, using the new horizontal offset
    // These can be the same relative path as the original outer tunnel, just shifted
    const pathPoints = [
        new THREE.Vector3(horizontalOffset_New, 0, (segmentLength / 2) + 55), 
        new THREE.Vector3(horizontalOffset_New, 0, (segmentLength / 2) + 50), 
        new THREE.Vector3(horizontalOffset_New, 0, segmentLength / 2),      
        new THREE.Vector3(-segmentLength / 2 + horizontalOffset_New, 0, segmentLength / 2), 
        new THREE.Vector3(-segmentLength / 2 + horizontalOffset_New, 0, -segmentLength / 2), 
        new THREE.Vector3(segmentLength / 2 + horizontalOffset_New, 0, -segmentLength / 2), 
        new THREE.Vector3(segmentLength / 2 + horizontalOffset_New, 0, -segmentLength * 1.5), 
        new THREE.Vector3(-segmentLength / 2 + horizontalOffset_New, 0, -segmentLength * 1.5), 
        new THREE.Vector3(-segmentLength / 2 + horizontalOffset_New, 0, -segmentLength * 2.5) 
    ];

    // --- Create Visual Mesh ---
    const visualSteps = 100; 
    const visualProfilePoints = 20; // Ignored for rectangular profile
    const visualPath = new THREE.CatmullRomCurve3(pathPoints);
    const visualExtrudeSettings = { steps: visualSteps, bevelEnabled: false, extrudePath: visualPath };
    const tunnelVisMaterial = new THREE.MeshStandardMaterial({
        color: 0x777777, // Original: 0x4466FF (A blueish color to differentiate) -> Light gray to match original outer
        side: THREE.DoubleSide,
        wireframe: false,
        transparent: true,
        opacity: 0.4 // Original: 0.5 (Slightly different opacity) -> Same opacity as original outer
    });
    
    // Create a rectangular profile (same as outer tunnel)
    const profilePoints = [];
    profilePoints.push(new THREE.Vector2(-newTunnelWidth / 2, 0)); 
    profilePoints.push(new THREE.Vector2(-newTunnelWidth / 2, newTunnelHeight)); 
    profilePoints.push(new THREE.Vector2(newTunnelWidth / 2, newTunnelHeight)); 
    profilePoints.push(new THREE.Vector2(newTunnelWidth / 2, 0)); 
    profilePoints.push(new THREE.Vector2(-newTunnelWidth / 2, 0)); 
    
    const tunnelVertices = [];
    const tunnelFaces = [];
    const pathSegments = visualExtrudeSettings.steps;
    const frames = visualPath.computeFrenetFrames(pathSegments, false);
    const worldUp = new THREE.Vector3(0, 1, 0);
    const rotationMatrix = new THREE.Matrix4();
    const translationMatrix = new THREE.Matrix4();
    const transformationMatrix = new THREE.Matrix4();
    const localVertex = new THREE.Vector3();
    const worldVertex = new THREE.Vector3();

    for (let i = 0; i <= pathSegments; i++) {
        const point = visualPath.getPointAt(i / pathSegments);
        const tangent = frames.tangents[i];
        
        const axisZ = tangent.clone();
        const axisX = worldUp.clone().cross(axisZ).normalize();
        const axisY = axisZ.clone().cross(axisX).normalize();

        rotationMatrix.makeBasis(axisX, axisY, axisZ);
        translationMatrix.makeTranslation(point.x, point.y, point.z);
        transformationMatrix.multiplyMatrices(translationMatrix, rotationMatrix);

        for (let j = 0; j < profilePoints.length; j++) {
            const profilePoint = profilePoints[j];
            localVertex.set(profilePoint.x, profilePoint.y, 0);
            worldVertex.copy(localVertex).applyMatrix4(transformationMatrix);
            tunnelVertices.push(worldVertex.x, worldVertex.y, worldVertex.z);
        }
        
        if (i > 0) {
            const baseIdx = (i - 1) * profilePoints.length;
            const currentBaseIdx = i * profilePoints.length;
            for (let j = 0; j < profilePoints.length - 1; j++) {
                const v1 = baseIdx + j; const v2 = baseIdx + j + 1; 
                const v3 = currentBaseIdx + j + 1; const v4 = currentBaseIdx + j;
                tunnelFaces.push(v1, v2, v4); tunnelFaces.push(v2, v3, v4);
            }
        }
    }
    
    const tunnelGeometry = new THREE.BufferGeometry();
    tunnelGeometry.setAttribute('position', new THREE.Float32BufferAttribute(tunnelVertices, 3));
    tunnelGeometry.setIndex(tunnelFaces);
    tunnelGeometry.computeVertexNormals();
    secondLargeTunnelMesh = new THREE.Mesh(tunnelGeometry, tunnelVisMaterial); // Use new global var
    secondLargeTunnelMesh.castShadow = true;
    secondLargeTunnelMesh.receiveShadow = true;
    scene.add(secondLargeTunnelMesh);
    console.log("Second large tunnel VISUAL mesh added to scene.");

    // --- Create Cannon.js BOXES for Second Large Tunnel Physics ---
    console.log("Creating Second Large Tunnel Physics using BOXES...");
    const boxMaterial = concreteMaterial; 
    const tunnelBodies = []; 

    for (let i = 0; i < pathPoints.length - 1; i++) {
        const startPoint = pathPoints[i];
        const endPoint = pathPoints[i+1];
        const segmentVector = endPoint.clone().sub(startPoint);
        const segmentMidpoint = startPoint.clone().add(segmentVector.clone().multiplyScalar(0.5));
        const segmentLengthActual = segmentVector.length();
        
        if (segmentLengthActual === 0) {
            console.warn(`Second Large Tunnel Segment ${i} has zero length! Skipping physics box creation.`);
            continue;
        }

        const normalizedSegmentVector = segmentVector.clone(); 
        normalizedSegmentVector.normalize(); 

        // --- Floor Box ---
        const floorShape = new CANNON.Box(new CANNON.Vec3(newTunnelWidth / 2, wallThickness / 2, segmentLengthActual / 2));
        const floorBody = new CANNON.Body({ mass: 0, material: boxMaterial, shape: floorShape });
        floorBody.position.set(segmentMidpoint.x, -wallThickness / 2, segmentMidpoint.z); 
        
        const fromVector = new CANNON.Vec3(0, 0, 1);
        const toVector = normalizedSegmentVector;
        const axis = new CANNON.Vec3();
        fromVector.cross(toVector, axis);

        if (axis.lengthSquared() < 1e-8) {
            if (toVector.dot(fromVector) > 0) {
                floorBody.quaternion.set(0, 0, 0, 1);
            } else {
                floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI);
            }
        } else {
            axis.normalize();
            const dot = fromVector.dot(toVector);
            const clampedDot = Math.max(-1, Math.min(1, dot)); 
            const angle = Math.acos(clampedDot); 
            floorBody.quaternion.setFromAxisAngle(axis, angle);
        }
        
        world.addBody(floorBody);
        tunnelBodies.push(floorBody);

        // --- Wall Calculations ---
        const wallShape = new CANNON.Box(new CANNON.Vec3(wallThickness / 2, newTunnelHeight / 2, segmentLengthActual / 2));
        
        // Perpendicular vector needs to use the normalized segment vector from THIS tunnel segment
        const perpendicularLeft = new CANNON.Vec3(-normalizedSegmentVector.z, 0, normalizedSegmentVector.x);
        // No need to normalize again if normalizedSegmentVector was already unit length and perpendicular correctly calculated.
        // However, direct construction from a normalized vector is safer:
        // const perpendicularLeft = new CANNON.Vec3(-normalizedSegmentVector.z, 0, normalizedSegmentVector.x);
        // If segmentVector was (A,0,B) normalized, perpendicularLeft is (-B,0,A) which is also normalized.

        const offsetAmount = newTunnelWidth / 2 + wallThickness / 2;

        // --- Left Wall Box ---
        const leftWallOffset = perpendicularLeft.clone();
        leftWallOffset.scale(offsetAmount, leftWallOffset); 
        const leftWallPos = segmentMidpoint.clone().add(leftWallOffset); 
        const leftWallBody = new CANNON.Body({ mass: 0, material: boxMaterial, shape: wallShape });
        leftWallBody.position.set(leftWallPos.x, newTunnelHeight / 2, leftWallPos.z);
        leftWallBody.quaternion.copy(floorBody.quaternion);
        world.addBody(leftWallBody);
        tunnelBodies.push(leftWallBody);
        
        // --- Right Wall Box ---
        const rightWallOffset = perpendicularLeft.clone();
        rightWallOffset.scale(-offsetAmount, rightWallOffset); 
        const rightWallPos = segmentMidpoint.clone().add(rightWallOffset); 
        const rightWallBody = new CANNON.Body({ mass: 0, material: boxMaterial, shape: wallShape });
        rightWallBody.position.set(rightWallPos.x, newTunnelHeight / 2, rightWallPos.z);
        rightWallBody.quaternion.copy(floorBody.quaternion);
        world.addBody(rightWallBody);
        tunnelBodies.push(rightWallBody);

        // --- Ceiling Box ---
        const ceilingShape = new CANNON.Box(new CANNON.Vec3(newTunnelWidth / 2 + wallThickness, wallThickness / 2, segmentLengthActual / 2)); 
        const ceilingBody = new CANNON.Body({ mass: 0, material: boxMaterial, shape: ceilingShape });
        ceilingBody.position.set(segmentMidpoint.x, newTunnelHeight + wallThickness / 2, segmentMidpoint.z); 
        ceilingBody.quaternion.copy(floorBody.quaternion);
        world.addBody(ceilingBody);
        tunnelBodies.push(ceilingBody);
    }
    console.log(`Created ${tunnelBodies.length} physics boxes for the second large tunnel.`);

    console.log("createSecondLargeTunnel() finished.");
}

// --- Third Tunnel Creation (1m W x 2m H) ---
function createThirdTunnel() {
    if (!DEBUG_OUTER_TUNNEL_BOXES) { // Assuming same debug flag for now
        console.warn("DEBUG: Third tunnel physics disabled (using DEBUG_OUTER_TUNNEL_BOXES flag)");
        return;
    }
    console.log("createThirdTunnel() function executing...");
    const newTunnelWidth = 1.0; // 1m wide
    const newTunnelHeight = 2.0; // 2m tall (same as outer tunnels)
    const wallThickness = 0.1; // Thickness for physics boxes

    // Calculate new horizontal offset to place it to the right of the second large tunnel
    // Second large tunnel: width 2.0, center at horizontalOffset 6.35. Right edge = 6.35 + 1.0 = 7.35
    // Gap: 5.0m
    // Third tunnel left edge: 7.35 + 5.0 = 12.35
    // Third tunnel center (horizontalOffset_Third): 12.35 + (newTunnelWidth / 2) = 12.35 + 0.5 = 12.85
    const horizontalOffset_Third = 12.85;
    console.log(`Applying horizontal offset of ${horizontalOffset_Third}m to the third tunnel.`);

    // Path points define the centerline corners, using the new horizontal offset
    const pathPoints = [
        new THREE.Vector3(horizontalOffset_Third, 0, (segmentLength / 2) + 55),
        new THREE.Vector3(horizontalOffset_Third, 0, (segmentLength / 2) + 50),
        new THREE.Vector3(horizontalOffset_Third, 0, segmentLength / 2),
        new THREE.Vector3(-segmentLength / 2 + horizontalOffset_Third, 0, segmentLength / 2),
        new THREE.Vector3(-segmentLength / 2 + horizontalOffset_Third, 0, -segmentLength / 2),
        new THREE.Vector3(segmentLength / 2 + horizontalOffset_Third, 0, -segmentLength / 2),
        new THREE.Vector3(segmentLength / 2 + horizontalOffset_Third, 0, -segmentLength * 1.5),
        new THREE.Vector3(-segmentLength / 2 + horizontalOffset_Third, 0, -segmentLength * 1.5),
        new THREE.Vector3(-segmentLength / 2 + horizontalOffset_Third, 0, -segmentLength * 2.5)
    ];

    // --- Create Visual Mesh ---
    const visualSteps = 100;
    const visualPath = new THREE.CatmullRomCurve3(pathPoints);
    const visualExtrudeSettings = { steps: visualSteps, bevelEnabled: false, extrudePath: visualPath };
    const tunnelVisMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888, // Different color for distinction, e.g., slightly darker gray
        side: THREE.DoubleSide,
        wireframe: false,
        transparent: true,
        opacity: 0.45 // Slightly different opacity
    });

    const profilePoints = [];
    profilePoints.push(new THREE.Vector2(-newTunnelWidth / 2, 0));
    profilePoints.push(new THREE.Vector2(-newTunnelWidth / 2, newTunnelHeight));
    profilePoints.push(new THREE.Vector2(newTunnelWidth / 2, newTunnelHeight));
    profilePoints.push(new THREE.Vector2(newTunnelWidth / 2, 0));
    profilePoints.push(new THREE.Vector2(-newTunnelWidth / 2, 0));

    const tunnelVertices = [];
    const tunnelFaces = [];
    const pathSegments = visualExtrudeSettings.steps;
    const frames = visualPath.computeFrenetFrames(pathSegments, false);
    const worldUp = new THREE.Vector3(0, 1, 0);
    const rotationMatrix = new THREE.Matrix4();
    const translationMatrix = new THREE.Matrix4();
    const transformationMatrix = new THREE.Matrix4();
    const localVertex = new THREE.Vector3();
    const worldVertex = new THREE.Vector3();

    for (let i = 0; i <= pathSegments; i++) {
        const point = visualPath.getPointAt(i / pathSegments);
        const tangent = frames.tangents[i];
        const axisZ = tangent.clone();
        const axisX = worldUp.clone().cross(axisZ).normalize();
        const axisY = axisZ.clone().cross(axisX).normalize();
        rotationMatrix.makeBasis(axisX, axisY, axisZ);
        translationMatrix.makeTranslation(point.x, point.y, point.z);
        transformationMatrix.multiplyMatrices(translationMatrix, rotationMatrix);
        for (let j = 0; j < profilePoints.length; j++) {
            const profilePoint = profilePoints[j];
            localVertex.set(profilePoint.x, profilePoint.y, 0);
            worldVertex.copy(localVertex).applyMatrix4(transformationMatrix);
            tunnelVertices.push(worldVertex.x, worldVertex.y, worldVertex.z);
        }
        if (i > 0) {
            const baseIdx = (i - 1) * profilePoints.length;
            const currentBaseIdx = i * profilePoints.length;
            for (let j = 0; j < profilePoints.length - 1; j++) {
                const v1 = baseIdx + j; const v2 = baseIdx + j + 1;
                const v3 = currentBaseIdx + j + 1; const v4 = currentBaseIdx + j;
                tunnelFaces.push(v1, v2, v4); tunnelFaces.push(v2, v3, v4);
            }
        }
    }

    const tunnelGeometry = new THREE.BufferGeometry();
    tunnelGeometry.setAttribute('position', new THREE.Float32BufferAttribute(tunnelVertices, 3));
    tunnelGeometry.setIndex(tunnelFaces);
    tunnelGeometry.computeVertexNormals();
    thirdTunnelMesh = new THREE.Mesh(tunnelGeometry, tunnelVisMaterial); // Use new global var
    thirdTunnelMesh.castShadow = true;
    thirdTunnelMesh.receiveShadow = true;
    scene.add(thirdTunnelMesh);
    console.log("Third tunnel VISUAL mesh added to scene.");

    // --- Create Cannon.js BOXES for Third Tunnel Physics ---
    console.log("Creating Third Tunnel Physics using BOXES...");
    const boxMaterial = concreteMaterial;
    const tunnelBodies = [];

    for (let i = 0; i < pathPoints.length - 1; i++) {
        const startPoint = pathPoints[i];
        const endPoint = pathPoints[i+1];
        const segmentVector = endPoint.clone().sub(startPoint);
        const segmentMidpoint = startPoint.clone().add(segmentVector.clone().multiplyScalar(0.5));
        const segmentLengthActual = segmentVector.length();

        if (segmentLengthActual === 0) {
            console.warn(`Third Tunnel Segment ${i} has zero length! Skipping physics box creation.`);
            continue;
        }

        const normalizedSegmentVector = segmentVector.clone();
        normalizedSegmentVector.normalize();

        const floorShape = new CANNON.Box(new CANNON.Vec3(newTunnelWidth / 2, wallThickness / 2, segmentLengthActual / 2));
        const floorBody = new CANNON.Body({ mass: 0, material: boxMaterial, shape: floorShape });
        floorBody.position.set(segmentMidpoint.x, -wallThickness / 2, segmentMidpoint.z);
        const fromVector = new CANNON.Vec3(0, 0, 1);
        const toVector = normalizedSegmentVector;
        const axis = new CANNON.Vec3();
        fromVector.cross(toVector, axis);
        if (axis.lengthSquared() < 1e-8) {
            if (toVector.dot(fromVector) > 0) floorBody.quaternion.set(0, 0, 0, 1);
            else floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI);
        } else {
            axis.normalize();
            const dot = fromVector.dot(toVector);
            const clampedDot = Math.max(-1, Math.min(1, dot));
            const angle = Math.acos(clampedDot);
            floorBody.quaternion.setFromAxisAngle(axis, angle);
        }
        world.addBody(floorBody);
        tunnelBodies.push(floorBody);

        const wallShape = new CANNON.Box(new CANNON.Vec3(wallThickness / 2, newTunnelHeight / 2, segmentLengthActual / 2));
        const perpendicularLeft = new CANNON.Vec3(-normalizedSegmentVector.z, 0, normalizedSegmentVector.x);
        const offsetAmount = newTunnelWidth / 2 + wallThickness / 2;

        const leftWallOffset = perpendicularLeft.clone();
        leftWallOffset.scale(offsetAmount, leftWallOffset);
        const leftWallPos = segmentMidpoint.clone().add(leftWallOffset);
        const leftWallBody = new CANNON.Body({ mass: 0, material: boxMaterial, shape: wallShape });
        leftWallBody.position.set(leftWallPos.x, newTunnelHeight / 2, leftWallPos.z);
        leftWallBody.quaternion.copy(floorBody.quaternion);
        world.addBody(leftWallBody);
        tunnelBodies.push(leftWallBody);

        const rightWallOffset = perpendicularLeft.clone();
        rightWallOffset.scale(-offsetAmount, rightWallOffset);
        const rightWallPos = segmentMidpoint.clone().add(rightWallOffset);
        const rightWallBody = new CANNON.Body({ mass: 0, material: boxMaterial, shape: wallShape });
        rightWallBody.position.set(rightWallPos.x, newTunnelHeight / 2, rightWallPos.z);
        rightWallBody.quaternion.copy(floorBody.quaternion);
        world.addBody(rightWallBody);
        tunnelBodies.push(rightWallBody);

        const ceilingShape = new CANNON.Box(new CANNON.Vec3(newTunnelWidth / 2 + wallThickness, wallThickness / 2, segmentLengthActual / 2));
        const ceilingBody = new CANNON.Body({ mass: 0, material: boxMaterial, shape: ceilingShape });
        ceilingBody.position.set(segmentMidpoint.x, newTunnelHeight + wallThickness / 2, segmentMidpoint.z);
        ceilingBody.quaternion.copy(floorBody.quaternion);
        world.addBody(ceilingBody);
        tunnelBodies.push(ceilingBody);
    }
    console.log(`Created ${tunnelBodies.length} physics boxes for the third tunnel.`);
    console.log("createThirdTunnel() finished.");
}

// --- Blast Door Creation ---
function createBlastDoor() {
    console.log("createBlastDoor() function executing...");
    
    // Blast door specifications (meters)
    const doorWidth = 0.7;    // 70 cm width
    const doorHeight = 1.7;   // 170 cm height
    const doorThickness = 0.08; // 8 cm thickness
    
    // Position: 2m after outer tunnel starts
    // The outer tunnel starts at Z=(segmentLength/2)+55
    const doorZ = (segmentLength / 2) + 53;
    
    // Use the same horizontal offset as the outer tunnel to center the door
    // The outer tunnel offset was -0.65m, but we want this centered in the tunnel
    const horizontalOffset = -0.65; // From outer tunnel
    
    // Get outer tunnel width and position for the concrete walls
    const outerTunnelWidth = 2.0; // The width of the outer tunnel
    const wallThickness = doorThickness; // Same thickness as the door
    
    console.log(`Creating blast door (${doorWidth}m x ${doorHeight}m x ${doorThickness}m) at Z=${doorZ}m with offset X=${horizontalOffset}m`);
    
    // Create visual mesh for the blast door - UPDATED COLOR TO BLACK
    const doorGeometry = new THREE.BoxGeometry(doorWidth, doorHeight, doorThickness);
    const doorMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000, // Pure black
        metalness: 0.8,
        roughness: 0.3,
        emissive: 0x111111,
        emissiveIntensity: 0.1
    });
    
    blastDoorMesh = new THREE.Mesh(doorGeometry, doorMaterial);
    blastDoorMesh.position.set(horizontalOffset, doorHeight / 2, doorZ);
    blastDoorMesh.castShadow = true;
    blastDoorMesh.receiveShadow = true;
    
    // Add details to the door (frame, bolts, etc.) - YELLOW STRIPES REMOVED
    addDoorDetails(blastDoorMesh, doorWidth, doorHeight, doorThickness);
    
    scene.add(blastDoorMesh);
    console.log("Blast door visual mesh added to scene.");
    
    // Create physics body for the blast door
    const doorShape = new CANNON.Box(new CANNON.Vec3(doorWidth/2, doorHeight/2, doorThickness/2));
    blastDoorBody = new CANNON.Body({
        mass: 0, // Static body
        material: concreteMaterial, // Reuse existing material
        shape: doorShape
    });
    blastDoorBody.position.copy(blastDoorMesh.position);
    // Add userData to track hits
    blastDoorBody.userData = { hitCount: 0, isDestroyed: false };
    world.addBody(blastDoorBody);
    console.log("Blast door physics body added to world.");
    console.log(`>>> Blast Door Body ID: ${blastDoorBody.id}`); // <<< ADD LOG FOR ID
    
    // --------------------
    // ADD CONCRETE WALLS ON BOTH SIDES OF DOOR
    // --------------------
    
    // Calculate the edges of the door
    const doorLeftEdge = horizontalOffset - doorWidth/2;
    const doorRightEdge = horizontalOffset + doorWidth/2;
    
    // Calculate the edges of the outer tunnel
    const tunnelLeftEdge = horizontalOffset - outerTunnelWidth/2;
    const tunnelRightEdge = horizontalOffset + outerTunnelWidth/2;
    
    // Calculate wall widths - actual distance from door edge to tunnel edge
    const leftWallWidth = Math.abs(doorLeftEdge - tunnelLeftEdge);
    const rightWallWidth = Math.abs(tunnelRightEdge - doorRightEdge);
    
    // Calculate wall center positions (halfway between door edge and tunnel edge)
    const leftWallX = (doorLeftEdge + tunnelLeftEdge) / 2;
    const rightWallX = (doorRightEdge + tunnelRightEdge) / 2;
    
    console.log(`Door edges: left=${doorLeftEdge.toFixed(2)}, right=${doorRightEdge.toFixed(2)}`);
    console.log(`Tunnel edges: left=${tunnelLeftEdge.toFixed(2)}, right=${tunnelRightEdge.toFixed(2)}`);
    console.log(`Creating concrete walls: left width=${leftWallWidth.toFixed(2)}m at x=${leftWallX.toFixed(2)}, right width=${rightWallWidth.toFixed(2)}m at x=${rightWallX.toFixed(2)}`);
    
    // Create concrete material
    const concreteMeshMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888, // Gray concrete
        roughness: 0.9,
        metalness: 0.1
    });
    
    // --- Left Concrete Wall ---
    const leftWallGeometry = new THREE.BoxGeometry(leftWallWidth, doorHeight, wallThickness);
    const leftWallMesh = new THREE.Mesh(leftWallGeometry, concreteMeshMaterial);
    
    // Position at the calculated center position
    leftWallMesh.position.set(leftWallX, doorHeight / 2, doorZ);
    leftWallMesh.castShadow = true;
    leftWallMesh.receiveShadow = true;
    scene.add(leftWallMesh);
    
    // Left wall physics body
    const leftWallShape = new CANNON.Box(new CANNON.Vec3(leftWallWidth/2, doorHeight/2, wallThickness/2));
    // Assign to global variable
    firstBlastDoorLeftWallBody = new CANNON.Body({
        mass: 0,
        material: concreteMaterial,
        shape: leftWallShape
    });
    firstBlastDoorLeftWallBody.position.copy(leftWallMesh.position);
    world.addBody(firstBlastDoorLeftWallBody);
    
    // --- Right Concrete Wall ---
    const rightWallGeometry = new THREE.BoxGeometry(rightWallWidth, doorHeight, wallThickness);
    const rightWallMesh = new THREE.Mesh(rightWallGeometry, concreteMeshMaterial);
    
    // Position at the calculated center position
    rightWallMesh.position.set(rightWallX, doorHeight / 2, doorZ);
    rightWallMesh.castShadow = true;
    rightWallMesh.receiveShadow = true;
    scene.add(rightWallMesh);
    
    // Right wall physics body
    const rightWallShape = new CANNON.Box(new CANNON.Vec3(rightWallWidth/2, doorHeight/2, wallThickness/2));
    // Assign to global variable
    rightWallBody = new CANNON.Body({
        mass: 0,
        material: concreteMaterial,
        shape: rightWallShape
    });
    rightWallBody.position.copy(rightWallMesh.position);
    world.addBody(rightWallBody);
    console.log(`>>> Right Wall Body ID: ${rightWallBody.id}`); // <<< ADD LOG FOR ID
}

// --- Create Blast Door for Second Large Tunnel ---
function createBlastDoorForSecondTunnel(newTunnelCenterX, newTunnelActualWidth) {
    console.log(`createBlastDoorForSecondTunnel() function executing for tunnel at X=${newTunnelCenterX}...`);
    
    // Blast door specifications (meters) - kept same as original
    const doorWidth = 0.7;    
    const doorHeight = 1.7;   
    const doorThickness = 0.08; 
    
    // Position: Z-coordinate same as the original blast door
    const doorZ = (segmentLength / 2) + 53;
    
    // Horizontal offset is the center of the new tunnel
    const horizontalOffset_New = newTunnelCenterX; 
    
    // The new tunnel's width (passed as newTunnelActualWidth)
    const currentTunnelWidth = newTunnelActualWidth; 
    const wallThickness = doorThickness; // Same thickness as the door
    
    console.log(`Creating second blast door (${doorWidth}m x ${doorHeight}m x ${doorThickness}m) at Z=${doorZ}m with offset X=${horizontalOffset_New}m`);
    
    const doorGeometry = new THREE.BoxGeometry(doorWidth, doorHeight, doorThickness);
    const doorMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000, 
        metalness: 0.8,
        roughness: 0.3,
        emissive: 0x111111,
        emissiveIntensity: 0.1
    });
    
    secondBlastDoorMesh = new THREE.Mesh(doorGeometry, doorMaterial);
    secondBlastDoorMesh.position.set(horizontalOffset_New, doorHeight / 2, doorZ);
    secondBlastDoorMesh.castShadow = true;
    secondBlastDoorMesh.receiveShadow = true;
    
    // Add details (frame, bolts, etc.) - using the same helper function
    // Note: addDoorDetails adds children to the scene directly, centered on the doorMesh passed.
    // For simplicity, we might not add unique details or make them distinct yet unless specified.
    // Calling it will add details around secondBlastDoorMesh.
    addDoorDetails(secondBlastDoorMesh, doorWidth, doorHeight, doorThickness); 
    
    scene.add(secondBlastDoorMesh);
    console.log("Second blast door visual mesh added to scene.");
    
    const doorShape = new CANNON.Box(new CANNON.Vec3(doorWidth/2, doorHeight/2, doorThickness/2));
    secondBlastDoorBody = new CANNON.Body({
        mass: 0, // Static body
        material: concreteMaterial, 
        shape: doorShape
    });
    secondBlastDoorBody.position.copy(secondBlastDoorMesh.position);
    // If this door needs to be destructible later, it would need its own userData for hitCount etc.
    secondBlastDoorBody.userData = { hitCount: 0, isDestroyed: false }; 
    world.addBody(secondBlastDoorBody);
    console.log("Second blast door physics body added to world.");
    // console.log(`>>> Second Blast Door Body ID: ${secondBlastDoorBody.id}`); 

    // --- ADD CONCRETE WALLS ON BOTH SIDES OF THE SECOND DOOR ---
    const doorLeftEdge = horizontalOffset_New - doorWidth/2;
    const doorRightEdge = horizontalOffset_New + doorWidth/2;
    
    const tunnelLeftEdge = horizontalOffset_New - currentTunnelWidth/2;
    const tunnelRightEdge = horizontalOffset_New + currentTunnelWidth/2;
    
    const leftWallWidth = Math.abs(doorLeftEdge - tunnelLeftEdge);
    const rightWallWidth = Math.abs(tunnelRightEdge - doorRightEdge);
    
    const leftWallX = (doorLeftEdge + tunnelLeftEdge) / 2;
    const rightWallX = (doorRightEdge + tunnelRightEdge) / 2;
    
    console.log(`Second Door walls: Door edges: left=${doorLeftEdge.toFixed(2)}, right=${doorRightEdge.toFixed(2)}`);
    console.log(`Second Door walls: Tunnel edges: left=${tunnelLeftEdge.toFixed(2)}, right=${tunnelRightEdge.toFixed(2)}`);
    console.log(`Second Door walls: Creating concrete walls: left width=${leftWallWidth.toFixed(2)}m at x=${leftWallX.toFixed(2)}, right width=${rightWallWidth.toFixed(2)}m at x=${rightWallX.toFixed(2)}`);

    const concreteMeshMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888, 
        roughness: 0.9,
        metalness: 0.1
    });
    
    // --- Left Concrete Wall (Second Door) ---
    if (leftWallWidth > 0.01) { // Only add wall if it has significant width
        const leftWallGeometry_s = new THREE.BoxGeometry(leftWallWidth, doorHeight, wallThickness);
        const leftWallMesh_s = new THREE.Mesh(leftWallGeometry_s, concreteMeshMaterial);
        leftWallMesh_s.position.set(leftWallX, doorHeight / 2, doorZ);
        leftWallMesh_s.castShadow = true;
        leftWallMesh_s.receiveShadow = true;
        scene.add(leftWallMesh_s);
        
        const leftWallShape_s = new CANNON.Box(new CANNON.Vec3(leftWallWidth/2, doorHeight/2, wallThickness/2));
        // Assign to global variable
        secondBlastDoorLeftWallBody = new CANNON.Body({ mass: 0, material: concreteMaterial, shape: leftWallShape_s });
        secondBlastDoorLeftWallBody.position.copy(leftWallMesh_s.position);
        world.addBody(secondBlastDoorLeftWallBody);
    } else {
        console.log("Second Door walls: Left wall width is too small, not adding.");
    }
    
    // --- Right Concrete Wall (Second Door) ---
    if (rightWallWidth > 0.01) { // Only add wall if it has significant width
        const rightWallGeometry_s = new THREE.BoxGeometry(rightWallWidth, doorHeight, wallThickness);
        const rightWallMesh_s = new THREE.Mesh(rightWallGeometry_s, concreteMeshMaterial);
        rightWallMesh_s.position.set(rightWallX, doorHeight / 2, doorZ);
        rightWallMesh_s.castShadow = true;
        rightWallMesh_s.receiveShadow = true;
        scene.add(rightWallMesh_s);
        
        const rightWallShape_s = new CANNON.Box(new CANNON.Vec3(rightWallWidth/2, doorHeight/2, wallThickness/2));
        // Assign to global variable
        secondBlastDoorRightWallBody = new CANNON.Body({ mass: 0, material: concreteMaterial, shape: rightWallShape_s });
        secondBlastDoorRightWallBody.position.copy(rightWallMesh_s.position);
        world.addBody(secondBlastDoorRightWallBody);
    } else {
        console.log("Second Door walls: Right wall width is too small, not adding.");
    }
    console.log("createBlastDoorForSecondTunnel() finished.");
}

// --- Create Blast Door for Third Tunnel ---
function createBlastDoorForThirdTunnel(thirdTunnelCenterX, thirdTunnelActualWidth) {
    console.log(`createBlastDoorForThirdTunnel() function executing for tunnel at X=${thirdTunnelCenterX}...`);
    
    // Blast door specifications (meters)
    const originalDoorWidthForRatio = 0.7; // Width of door in 2m wide tunnels
    const originalTunnelWidthForRatio = 2.0;
    const doorWidthRatio = originalDoorWidthForRatio / originalTunnelWidthForRatio;

    const doorWidth = thirdTunnelActualWidth; // Full tunnel width
    const doorHeight = 1.7;   // Kept same as original, as tunnel height is also 2m
    const doorThickness = 0.08; // Kept same as original
    
    const doorZ = (segmentLength / 2) + 53; // Z-coordinate same as other blast doors
    const horizontalOffset_Third = thirdTunnelCenterX; 
    const currentTunnelWidth = thirdTunnelActualWidth; 
    const wallThickness = doorThickness; 
    
    console.log(`Creating third blast door (${doorWidth.toFixed(2)}m x ${doorHeight}m x ${doorThickness}m) at Z=${doorZ}m with offset X=${horizontalOffset_Third}m`);
    
    const doorGeometry = new THREE.BoxGeometry(doorWidth, doorHeight, doorThickness);
    const doorMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000, 
        metalness: 0.8,
        roughness: 0.3,
        emissive: 0x111111,
        emissiveIntensity: 0.1
    });
    
    thirdBlastDoorMesh = new THREE.Mesh(doorGeometry, doorMaterial); // Use new global var
    thirdBlastDoorMesh.position.set(horizontalOffset_Third, doorHeight / 2, doorZ);
    thirdBlastDoorMesh.castShadow = true;
    thirdBlastDoorMesh.receiveShadow = true;
    
    addDoorDetails(thirdBlastDoorMesh, doorWidth, doorHeight, doorThickness); 
    
    scene.add(thirdBlastDoorMesh);
    console.log("Third blast door visual mesh added to scene.");
    
    const doorShape = new CANNON.Box(new CANNON.Vec3(doorWidth/2, doorHeight/2, doorThickness/2));
    thirdBlastDoorBody = new CANNON.Body({ // Use new global var
        mass: 0, 
        material: concreteMaterial, 
        shape: doorShape
    });
    thirdBlastDoorBody.position.copy(thirdBlastDoorMesh.position);
    thirdBlastDoorBody.userData = { hitCount: 0, isDestroyed: false }; 
    world.addBody(thirdBlastDoorBody);
    console.log("Third blast door physics body added to world.");

    // --- ADD CONCRETE WALLS ON BOTH SIDES OF THE THIRD DOOR ---
    const doorLeftEdge = horizontalOffset_Third - doorWidth/2;
    const doorRightEdge = horizontalOffset_Third + doorWidth/2;
    
    const tunnelLeftEdge = horizontalOffset_Third - currentTunnelWidth/2;
    const tunnelRightEdge = horizontalOffset_Third + currentTunnelWidth/2;
    
    const leftWallWidth = Math.max(0, doorLeftEdge - tunnelLeftEdge); // Ensure non-negative
    const rightWallWidth = Math.max(0, tunnelRightEdge - doorRightEdge); // Ensure non-negative
    
    const leftWallX = tunnelLeftEdge + leftWallWidth / 2;
    const rightWallX = tunnelRightEdge - rightWallWidth / 2;
    
    console.log(`Third Door walls: Door edges: left=${doorLeftEdge.toFixed(2)}, right=${doorRightEdge.toFixed(2)}`);
    console.log(`Third Door walls: Tunnel edges: left=${tunnelLeftEdge.toFixed(2)}, right=${tunnelRightEdge.toFixed(2)}`);
    console.log(`Third Door walls: Creating concrete walls: left width=${leftWallWidth.toFixed(2)}m at x=${leftWallX.toFixed(2)}, right width=${rightWallWidth.toFixed(2)}m at x=${rightWallX.toFixed(2)}`);

    const concreteMeshMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888, 
        roughness: 0.9,
        metalness: 0.1
    });
    
    if (leftWallWidth > 0.01) { 
        const leftWallGeometry_t = new THREE.BoxGeometry(leftWallWidth, doorHeight, wallThickness);
        const leftWallMesh_t = new THREE.Mesh(leftWallGeometry_t, concreteMeshMaterial);
        leftWallMesh_t.position.set(leftWallX, doorHeight / 2, doorZ);
        leftWallMesh_t.castShadow = true;
        leftWallMesh_t.receiveShadow = true;
        scene.add(leftWallMesh_t);
        
        const leftWallShape_t = new CANNON.Box(new CANNON.Vec3(leftWallWidth/2, doorHeight/2, wallThickness/2));
        thirdBlastDoorLeftWallBody = new CANNON.Body({ mass: 0, material: concreteMaterial, shape: leftWallShape_t }); // Use new global var
        thirdBlastDoorLeftWallBody.position.copy(leftWallMesh_t.position);
        world.addBody(thirdBlastDoorLeftWallBody);
    } else {
        console.log("Third Door walls: Left wall width is too small, not adding.");
    }
    
    if (rightWallWidth > 0.01) { 
        const rightWallGeometry_t = new THREE.BoxGeometry(rightWallWidth, doorHeight, wallThickness);
        const rightWallMesh_t = new THREE.Mesh(rightWallGeometry_t, concreteMeshMaterial);
        rightWallMesh_t.position.set(rightWallX, doorHeight / 2, doorZ);
        rightWallMesh_t.castShadow = true;
        rightWallMesh_t.receiveShadow = true;
        scene.add(rightWallMesh_t);
        
        const rightWallShape_t = new CANNON.Box(new CANNON.Vec3(rightWallWidth/2, doorHeight/2, wallThickness/2));
        thirdBlastDoorRightWallBody = new CANNON.Body({ mass: 0, material: concreteMaterial, shape: rightWallShape_t }); // Use new global var
        thirdBlastDoorRightWallBody.position.copy(rightWallMesh_t.position);
        world.addBody(thirdBlastDoorRightWallBody);
    } else {
        console.log("Third Door walls: Right wall width is too small, not adding.");
    }
    console.log("createBlastDoorForThirdTunnel() finished.");
}

// --- Destroy Blast Door Function ---
function destroyBlastDoor() {
    if (blastDoorBody && !blastDoorBody.userData.isDestroyed) {
        console.log("Destroying Blast Door!");
        blastDoorBody.userData.isDestroyed = true; // Mark as destroyed

        // Find all door frame elements and related objects
        const doorObjects = [];
        scene.traverse((object) => {
            // Check if it's part of the door system (near the door position)
            if (object.isMesh && object !== blastDoorMesh && 
                Math.abs(object.position.z - blastDoorBody.position.z) < 0.5) {
                doorObjects.push(object);
                console.log(`Found door-related object: ${object.position.x.toFixed(2)}, ${object.position.y.toFixed(2)}, ${object.position.z.toFixed(2)}`);
            }
        });
        
        // Remove the physics body immediately
        world.removeBody(blastDoorBody);
        
        // Also remove or disable the concrete walls to clear the path completely
        if (rightWallBody) {
            console.log("Removing right wall physics body to clear doorway");
            world.removeBody(rightWallBody);
        }
        
        // Find and remove any other physics bodies near the door's Z position
        const doorZ = blastDoorBody.position.z;
        const bodiesToRemove = [];
        
        // Scan all physics bodies in the world to find those near the door
        for (let i = 0; i < world.bodies.length; i++) {
            const body = world.bodies[i];
            // Check if it's near the door and not the ground or robot
            if (body !== groundBody && body !== robotBody && 
                Math.abs(body.position.z - doorZ) < 1.0) {
                bodiesToRemove.push(body);
                console.log(`Found physics body to remove at position: ${body.position.x.toFixed(2)}, ${body.position.y.toFixed(2)}, ${body.position.z.toFixed(2)}`);
            }
        }
        
        // Remove all identified bodies
        for (const body of bodiesToRemove) {
            try {
                world.removeBody(body);
            } catch (e) {
                console.warn("Error removing physics body:", e);
            }
        }
        
        console.log(`Cleared ${bodiesToRemove.length} physics bodies from doorway`);
        
        // Create a simple animation to show the door falling
        // We'll do this directly instead of using physics to ensure it's visible
        if (blastDoorMesh) {
            console.log("Starting direct door animation");
            
            // Save initial position
            const startPos = blastDoorMesh.position.clone();
            const startRot = blastDoorMesh.rotation.clone();
            
            // Change material to red to indicate destruction
            if (blastDoorMesh.material) {
                blastDoorMesh.material.color.set(0xFF0000);
                blastDoorMesh.material.emissive.set(0x330000);
                blastDoorMesh.material.needsUpdate = true;
            }
            
            // Set up animation parameters
            const animationDuration = 1500; // ms
            const startTime = Date.now();
            
            // Make sure it's visible
            blastDoorMesh.visible = true;
            
            // Animation function using requestAnimationFrame for smoother animation
            function animateDoorFall() {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / animationDuration, 1);
                
                // Log animation progress
                if (elapsed % 100 < 20) { // Log roughly every 100ms
                    console.log(`Door fall animation: ${(progress * 100).toFixed(0)}%`);
                }
                
                // Fall and rotate
                blastDoorMesh.position.y = startPos.y - (progress * 4); // Fall down 4 meters
                blastDoorMesh.position.z = startPos.z - (progress * 2); // Move inward 2 meters
                
                // Rotate dramatically
                blastDoorMesh.rotation.x = startRot.x + (progress * Math.PI * 0.8); // Tilt forward
                blastDoorMesh.rotation.z = startRot.z + (progress * Math.PI * 0.2 * (Math.random() > 0.5 ? 1 : -1)); // Random tilt
                
                // Also animate any related door objects
                doorObjects.forEach(obj => {
                    obj.position.y = obj.position.y - (0.07 * progress); // Fall slightly
                    obj.position.z = obj.position.z - (0.05 * progress); // Move inward slightly
                    
                    // Add slight random rotation
                    obj.rotation.x += 0.01 * (Math.random() - 0.5);
                    obj.rotation.z += 0.01 * (Math.random() - 0.5);
                });
                
                // Continue animation until complete
                if (progress < 1) {
                    requestAnimationFrame(animateDoorFall);
                } else {
                    console.log("Door fall animation complete - cleaning up");
                    
                    // Remove door and decorations after animation completes
                    setTimeout(() => {
                        console.log("Removing door mesh from scene");
                        scene.remove(blastDoorMesh);
                        
                        // Clean up door decorations
                        doorObjects.forEach(obj => {
                            scene.remove(obj);
                        });
                    }, 3000); // Keep on ground for 3 seconds before cleaning up
                }
            }
            
            // Start animation
            animateDoorFall();
        }
    }
}

// --- Destroy First Blast Door Function ---
function destroyBlastDoor1() {
    if (blastDoorBody && !blastDoorBody.userData.isDestroyed) {
        console.log("Destroying First Blast Door!");
        blastDoorBody.userData.isDestroyed = true; // Mark as destroyed

        // Find all door frame elements and related objects for the FIRST door
        const doorObjects = [];
        const doorCenterX = blastDoorBody.position.x;
        const doorCenterZ = blastDoorBody.position.z;
        const doorWidth = 0.7; // Original door width for proximity check

        scene.traverse((object) => {
            if (object.isMesh && object !== blastDoorMesh &&
                Math.abs(object.position.z - doorCenterZ) < 0.5 && // Proximity in Z
                Math.abs(object.position.x - doorCenterX) < doorWidth * 1.5) { // Proximity in X (allow some margin for frame)
                doorObjects.push(object);
                console.log(`Found first door-related object: ${object.name || 'unnamed'} at X:${object.position.x.toFixed(2)}, Z:${object.position.z.toFixed(2)}`);
            }
        });
        
        // Remove the physics body immediately
        world.removeBody(blastDoorBody);
        
        // Remove the specific walls for the FIRST door
        if (firstBlastDoorLeftWallBody) {
            console.log("Removing first blast door's left wall physics body.");
            world.removeBody(firstBlastDoorLeftWallBody);
        }
        if (rightWallBody) { // rightWallBody is the first door's right wall
            console.log("Removing first blast door's right wall physics body.");
            world.removeBody(rightWallBody);
        }
        
        // The generic loop for removing bodies by Z was here. It's removed for being too broad.
        
        console.log("Cleared physics bodies for the first blast door.");
        
        if (blastDoorMesh) {
            console.log("Starting direct first door animation");
            const startPos = blastDoorMesh.position.clone();
            const startRot = blastDoorMesh.rotation.clone();
            
            if (blastDoorMesh.material) {
                blastDoorMesh.material.color.set(0xFF0000);
                blastDoorMesh.material.emissive.set(0x330000);
                blastDoorMesh.material.needsUpdate = true;
            }
            
            const animationDuration = 1500; 
            const startTime = Date.now();
            blastDoorMesh.visible = true;
            
            function animateDoorFall1() {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / animationDuration, 1);
                
                if (elapsed % 100 < 20) { 
                    console.log(`First Door fall animation: ${(progress * 100).toFixed(0)}%`);
                }
                
                blastDoorMesh.position.y = startPos.y - (progress * 4); 
                blastDoorMesh.position.z = startPos.z - (progress * 2); 
                blastDoorMesh.rotation.x = startRot.x + (progress * Math.PI * 0.8); 
                blastDoorMesh.rotation.z = startRot.z + (progress * Math.PI * 0.2 * (Math.random() > 0.5 ? 1 : -1)); 
                
                doorObjects.forEach(obj => {
                    obj.position.y = obj.position.y - (0.07 * progress); 
                    obj.position.z = obj.position.z - (0.05 * progress); 
                    obj.rotation.x += 0.01 * (Math.random() - 0.5);
                    obj.rotation.z += 0.01 * (Math.random() - 0.5);
                });
                
                if (progress < 1) {
                    requestAnimationFrame(animateDoorFall1);
                } else {
                    console.log("First Door fall animation complete - cleaning up");
                    setTimeout(() => {
                        console.log("Removing first door mesh from scene");
                        scene.remove(blastDoorMesh);
                        doorObjects.forEach(obj => { scene.remove(obj); });
                    }, 3000); 
                }
            }
            animateDoorFall1();
        }
    }
}

// --- Destroy Second Blast Door Function ---
function destroyBlastDoor2() {
    if (secondBlastDoorBody && !secondBlastDoorBody.userData.isDestroyed) {
        console.log("Destroying Second Blast Door!");
        secondBlastDoorBody.userData.isDestroyed = true; // Mark as destroyed

        // Find all door frame elements and related objects for the SECOND door
        const doorObjects = [];
        const doorCenterX = secondBlastDoorBody.position.x;
        const doorCenterZ = secondBlastDoorBody.position.z;
        const doorWidth = 0.7; // Original door width for proximity check

        scene.traverse((object) => {
            if (object.isMesh && object !== secondBlastDoorMesh &&
                Math.abs(object.position.z - doorCenterZ) < 0.5 && // Proximity in Z
                Math.abs(object.position.x - doorCenterX) < doorWidth * 1.5) { // Proximity in X
                doorObjects.push(object);
                 console.log(`Found second door-related object: ${object.name || 'unnamed'} at X:${object.position.x.toFixed(2)}, Z:${object.position.z.toFixed(2)}`);
            }
        });

        // Remove the physics body immediately
        world.removeBody(secondBlastDoorBody);

        // Remove the specific walls for the SECOND door
        if (secondBlastDoorLeftWallBody) {
            console.log("Removing second blast door's left wall physics body.");
            world.removeBody(secondBlastDoorLeftWallBody);
        }
        if (secondBlastDoorRightWallBody) {
            console.log("Removing second blast door's right wall physics body.");
            world.removeBody(secondBlastDoorRightWallBody);
        }

        console.log("Cleared physics bodies for the second blast door.");

        if (secondBlastDoorMesh) {
            console.log("Starting direct second door animation");
            const startPos = secondBlastDoorMesh.position.clone();
            const startRot = secondBlastDoorMesh.rotation.clone();

            if (secondBlastDoorMesh.material) {
                secondBlastDoorMesh.material.color.set(0xFF0000); // Red
                secondBlastDoorMesh.material.emissive.set(0x330000);
                secondBlastDoorMesh.material.needsUpdate = true;
            }

            const animationDuration = 1500; // ms
            const startTime = Date.now();
            secondBlastDoorMesh.visible = true;

            function animateDoorFall2() {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / animationDuration, 1);

                if (elapsed % 100 < 20) {
                    console.log(`Second Door fall animation: ${(progress * 100).toFixed(0)}%`);
                }

                secondBlastDoorMesh.position.y = startPos.y - (progress * 4);
                secondBlastDoorMesh.position.z = startPos.z - (progress * 2);
                secondBlastDoorMesh.rotation.x = startRot.x + (progress * Math.PI * 0.8);
                secondBlastDoorMesh.rotation.z = startRot.z + (progress * Math.PI * 0.2 * (Math.random() > 0.5 ? 1 : -1));

                doorObjects.forEach(obj => {
                    obj.position.y = obj.position.y - (0.07 * progress);
                    obj.position.z = obj.position.z - (0.05 * progress);
                    obj.rotation.x += 0.01 * (Math.random() - 0.5);
                    obj.rotation.z += 0.01 * (Math.random() - 0.5);
                });

                if (progress < 1) {
                    requestAnimationFrame(animateDoorFall2);
                } else {
                    console.log("Second Door fall animation complete - cleaning up");
                    setTimeout(() => {
                        console.log("Removing second door mesh from scene");
                        scene.remove(secondBlastDoorMesh);
                        doorObjects.forEach(obj => { scene.remove(obj); });
                    }, 3000);
                }
            }
            animateDoorFall2();
        }
    }
}

// --- Destroy Third Blast Door Function ---
function destroyBlastDoor3() {
    if (thirdBlastDoorBody && !thirdBlastDoorBody.userData.isDestroyed) {
        console.log("Destroying Third Blast Door!");
        thirdBlastDoorBody.userData.isDestroyed = true; // Mark as destroyed

        // Find all door frame elements and related objects for the THIRD door
        const doorObjects = [];
        const doorCenterX = thirdBlastDoorBody.position.x;
        const doorCenterZ = thirdBlastDoorBody.position.z;
        // Get the actual width of the third door mesh for proximity check, or use a default if mesh not found
        const doorWidth = thirdBlastDoorMesh ? thirdBlastDoorMesh.geometry.parameters.width : 0.35; 

        scene.traverse((object) => {
            if (object.isMesh && object !== thirdBlastDoorMesh &&
                Math.abs(object.position.z - doorCenterZ) < 0.5 && // Proximity in Z
                Math.abs(object.position.x - doorCenterX) < doorWidth * 1.5) { // Proximity in X
                doorObjects.push(object);
                 console.log(`Found third door-related object: ${object.name || 'unnamed'} at X:${object.position.x.toFixed(2)}, Z:${object.position.z.toFixed(2)}`);
            }
        });

        // Remove the physics body immediately
        world.removeBody(thirdBlastDoorBody);

        // Remove the specific walls for the THIRD door
        if (thirdBlastDoorLeftWallBody) {
            console.log("Removing third blast door's left wall physics body.");
            world.removeBody(thirdBlastDoorLeftWallBody);
        }
        if (thirdBlastDoorRightWallBody) {
            console.log("Removing third blast door's right wall physics body.");
            world.removeBody(thirdBlastDoorRightWallBody);
        }

        console.log("Cleared physics bodies for the third blast door.");

        if (thirdBlastDoorMesh) {
            console.log("Starting direct third door animation");
            const startPos = thirdBlastDoorMesh.position.clone();
            const startRot = thirdBlastDoorMesh.rotation.clone();

            if (thirdBlastDoorMesh.material) {
                thirdBlastDoorMesh.material.color.set(0xFF0000); // Red
                thirdBlastDoorMesh.material.emissive.set(0x330000);
                thirdBlastDoorMesh.material.needsUpdate = true;
            }

            const animationDuration = 1500; // ms
            const startTime = Date.now();
            thirdBlastDoorMesh.visible = true;

            function animateDoorFall3() {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / animationDuration, 1);

                if (elapsed % 100 < 20) {
                    console.log(`Third Door fall animation: ${(progress * 100).toFixed(0)}%`);
                }

                thirdBlastDoorMesh.position.y = startPos.y - (progress * 4);
                thirdBlastDoorMesh.position.z = startPos.z - (progress * 2);
                thirdBlastDoorMesh.rotation.x = startRot.x + (progress * Math.PI * 0.8);
                thirdBlastDoorMesh.rotation.z = startRot.z + (progress * Math.PI * 0.2 * (Math.random() > 0.5 ? 1 : -1));

                doorObjects.forEach(obj => {
                    obj.position.y = obj.position.y - (0.07 * progress);
                    obj.position.z = obj.position.z - (0.05 * progress);
                    obj.rotation.x += 0.01 * (Math.random() - 0.5);
                    obj.rotation.z += 0.01 * (Math.random() - 0.5);
                });

                if (progress < 1) {
                    requestAnimationFrame(animateDoorFall3);
                } else {
                    console.log("Third Door fall animation complete - cleaning up");
                    setTimeout(() => {
                        console.log("Removing third door mesh from scene");
                        scene.remove(thirdBlastDoorMesh);
                        doorObjects.forEach(obj => { scene.remove(obj); });
                    }, 3000);
                }
            }
            animateDoorFall3();
        }
    }
}

// Helper function to add visual details to the blast door
function addDoorDetails(doorMesh, width, height, thickness) {
    // Door frame (slightly larger than the door)
    const frameThickness = 0.05; // 5cm thick frame
    const frameWidth = width + 2 * frameThickness;
    const frameHeight = height + 2 * frameThickness;
    const frameDepth = thickness + 0.02; // Slightly thicker than the door
    
    const frameGeometry = new THREE.BoxGeometry(frameWidth, frameHeight, frameDepth);
    // Create a frame material
    const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222, // Dark gray to match black door
        metalness: 0.7,
        roughness: 0.4
    });
    
    // Create the frame without the center (to make a hollow frame)
    const frameMesh = new THREE.Mesh(frameGeometry, frameMaterial);
    frameMesh.position.copy(doorMesh.position);
    frameMesh.position.z -= 0.01; // Move slightly behind the door
    
    // Use Constructive Solid Geometry (CSG) to cut the door shape out of the frame
    // Since THREE.CSG may not be available, we'll simulate by using a smaller box as a cutout
    const cutoutGeometry = new THREE.BoxGeometry(width * 0.98, height * 0.98, frameDepth * 1.1);
    const cutoutMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0 // Invisible
    });
    const cutoutMesh = new THREE.Mesh(cutoutGeometry, cutoutMaterial);
    cutoutMesh.position.copy(doorMesh.position);
    
    // Add frame to scene instead of trying to do CSG (which is complex)
    scene.add(frameMesh);
    
    // Add bolts around the door (16 bolts, 4 on each side)
    const boltRadius = 0.02; // 2cm radius
    const boltGeometry = new THREE.CylinderGeometry(boltRadius, boltRadius, thickness * 1.5, 8);
    const boltMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888, // Silver
        metalness: 0.9,
        roughness: 0.2
    });
    
    // Place bolts around the door frame
    const boltPositions = [
        // Left side bolts
        [-width/2 - frameThickness/2, height/3, 0],
        [-width/2 - frameThickness/2, 0, 0],
        [-width/2 - frameThickness/2, -height/3, 0],
        
        // Right side bolts
        [width/2 + frameThickness/2, height/3, 0],
        [width/2 + frameThickness/2, 0, 0],
        [width/2 + frameThickness/2, -height/3, 0],
        
        // Top bolts
        [-width/3, height/2 + frameThickness/2, 0],
        [0, height/2 + frameThickness/2, 0],
        [width/3, height/2 + frameThickness/2, 0],
        
        // Bottom bolts
        [-width/3, -height/2 - frameThickness/2, 0],
        [0, -height/2 - frameThickness/2, 0],
        [width/3, -height/2 - frameThickness/2, 0]
    ];
    
    // Add each bolt to the scene
    boltPositions.forEach(pos => {
        const bolt = new THREE.Mesh(boltGeometry, boltMaterial);
        bolt.position.set(
            doorMesh.position.x + pos[0],
            doorMesh.position.y + pos[1],
            doorMesh.position.z + pos[2]
        );
        
        // Rotate horizontal bolts appropriately
        if (pos[1] === height/2 + frameThickness/2 || pos[1] === -height/2 - frameThickness/2) {
            bolt.rotation.z = Math.PI / 2; // Rotate horizontal
        }
        
        scene.add(bolt);
    });
    
    // Add a door handle (simple cylinder)
    const handleRadius = 0.03; // 3cm radius
    const handleLength = 0.15; // 15cm length
    const handleGeometry = new THREE.CylinderGeometry(handleRadius, handleRadius, handleLength, 16);
    const handleMaterial = new THREE.MeshStandardMaterial({
        color: 0xCCCCCC, // Light gray/silver
        metalness: 0.9,
        roughness: 0.1
    });
    
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.set(
        doorMesh.position.x + width/4, // Position on the right side
        doorMesh.position.y, // Center vertical
        doorMesh.position.z + thickness/2 + handleRadius // On the front surface
    );
    handle.rotation.x = Math.PI / 2; // Rotate to horizontal
    scene.add(handle);
    
    // REMOVED YELLOW WARNING STRIPES
    
    console.log("Added detailed features to blast door (no warning stripes)");
}

// --- Robot Creation - Re-enabled ---
function createRobot() {
    console.log("createRobot() called - Loading GLB model (brokk70258.glb)."); // <<< Updated log message

    // --- GLTF Model Loading ---
    const loader = new THREE.GLTFLoader();
    loader.load(
        'brokk70258.glb', // <<< Use new brokk70258.glb
        function (gltf) {
            // Assign the loaded scene to robotMesh
            robotMesh = gltf.scene; 

            // --- Find Parts and Setup Animation Data ---
            // Debug: List all objects (can be removed once working)
            console.log("=== All objects in GLB ===");
            robotMesh.traverse((child) => {
                if (child.name) console.log(`"${child.name}" (${child.type})`);
            });
            
            legL = robotMesh.getObjectByName('Leg_L');
            legR = robotMesh.getObjectByName('Leg_R'); // <<< Use 'Leg_R' instead of 'Leg_R'
            legLB = robotMesh.getObjectByName('Leg_LB'); // <<< Find Back Left
            legRB = robotMesh.getObjectByName('Leg_RB'); // <<< Find Back Right
            crane = robotMesh.getObjectByName('boom_main');     // <<< Find main boom (was 'crane')
            cranetip = robotMesh.getObjectByName('cranetip'); // <<< Find Cranetip
            crane001 = robotMesh.getObjectByName('crane.001'); // <<< Find new crane joint (with dot in new file!)
            
            console.log("=== Object Finding Results ===");
            console.log("legL:", legL ? legL.name : "NOT FOUND");
            console.log("legR:", legR ? legR.name : "NOT FOUND");
            console.log("legLB:", legLB ? legLB.name : "NOT FOUND");
            console.log("legRB:", legRB ? legRB.name : "NOT FOUND");
            console.log("crane (boom_main):", crane ? crane.name : "NOT FOUND");
            console.log("cranetip:", cranetip ? cranetip.name : "NOT FOUND");
            console.log("crane001:", crane001 ? crane001.name : "NOT FOUND");

            // --- Legs Setup ---
            const foldAngleLegs = THREE.MathUtils.degToRad(120); 
            // Right legs fold +70 deg around Z
            const qFoldLegsRight = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), foldAngleLegs);
            // Left legs fold -70 deg around Z
            const qFoldLegsLeft = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -foldAngleLegs);
            
            // Store references in an object for easier checking
            const legs = {
                'Leg_L': legL,
                'Leg_R': legR, // <<< Use 'Leg_R' as key
                'Leg_LB': legLB,
                'Leg_RB': legRB
            };
            const expectedLegNames = ['Leg_L', 'Leg_R', 'Leg_LB', 'Leg_RB']; // <<< Use 'Leg_R' in list

            expectedLegNames.forEach(name => {
                const leg = legs[name]; // Get the reference
                if (leg) {
                    console.log(`Found leg: ${leg.name}`);
                    leg.userData.home = leg.quaternion.clone();
                    // Use Z-axis (0, 0, 1) for folding up
                    // Apply different rotation based on leg name
                    // Left-Front (L) and Right-Back (RB) fold negative
                    if (name === 'Leg_L' || name === 'Leg_RB') { 
                        leg.userData.fold = qFoldLegsLeft.clone().multiply(leg.userData.home);
                        console.log(`  Applied LEFT fold rotation (-${(foldAngleLegs * 180 / Math.PI).toFixed(1)} deg) to ${name}`);
                    } else { // Right-Front (R) and Left-Back (LB) fold positive
                        leg.userData.fold = qFoldLegsRight.clone().multiply(leg.userData.home);
                        console.log(`  Applied RIGHT fold rotation (+${(foldAngleLegs * 180 / Math.PI).toFixed(1)} deg) to ${name}`);
                    }
                } else {
                    // Log exactly which expected leg name was not found
                    console.warn(`Could not find leg with name: ${name} in the loaded model!`); 
                }
            });
            
            // --- Crane Setup (boom_main) ---
            const foldAngleCrane = THREE.MathUtils.degToRad(45);
            // Assume folding inwards is around local X-axis
            const qFoldCrane = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), foldAngleCrane);

            if (crane) {
                console.log(`Found main boom (crane): ${crane.name}`);
                crane.userData.home = crane.quaternion.clone();
                crane.userData.fold = qFoldCrane.clone().multiply(crane.userData.home);
            } else {
                console.warn("Could not find 'boom_main' in the loaded model!");
            }

            // --- Crane.001 Setup ---
            const foldAngleCrane001 = THREE.MathUtils.degToRad(60); // Different angle for crane.001
            const qFoldCrane001 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), foldAngleCrane001);

            if (crane001) {
                console.log(`Found crane.001: ${crane001.name}`);
                crane001.userData.home = crane001.quaternion.clone();
                crane001.userData.fold = qFoldCrane001.clone().multiply(crane001.userData.home);
            } else {
                console.warn("Could not find 'crane.001' in the loaded model!");
            }
            
            // Create physics body for crane after model is loaded (if needed)
            if (crane && cranetip) {
                createCranePhysics();
            }
            
            // --- Cranetip Setup ---
             const foldAngleCranetip = THREE.MathUtils.degToRad(80); // Can be different angle if needed
            // Assume folding inwards is around local X-axis
            const qFoldCranetip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), foldAngleCranetip);

            if (cranetip) {
                console.log(`Found cranetip: ${cranetip.name}`);
                cranetip.userData.home = cranetip.quaternion.clone();
                cranetip.userData.fold = qFoldCranetip.clone().multiply(cranetip.userData.home);
            } else {
                console.warn("Could not find cranetip in the loaded model!");
            }
            // -------------------------------------------

            // Scale the model if necessary (adjust as needed)
            // robotMesh.scale.set(0.1, 0.1, 0.1); 

            // Iterate through the model to set shadows AND adjust material brightness
            robotMesh.traverse(function (node) {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
            
                    // --- Adjust material brightness ---
                    if (node.material) {
                        // Ensure we handle potential arrays of materials
                        const materials = Array.isArray(node.material) ? node.material : [node.material];
                        materials.forEach(material => {
                            // Check if the material has a color property we can modify
                            if (material.color) {
                                material.color.multiplyScalar(1.5); // Increase brightness by 50%
                                console.log(`Adjusted color brightness for material on mesh: ${node.name || '(no name)'}`);
                            }
                            // Ensure material updates if necessary (usually automatic, but good practice)
                            material.needsUpdate = true; 
                        });
                    }
                    // ------------------------------------
                }
            });

            // Set initial position AFTER loading
            robotMesh.position.copy(ROBOT_START_POS); // Uses physics body position eventually
            scene.add(robotMesh);
            console.log("brokk70258.glb model loaded and added to scene."); // <<< Updated log message
            
             // Set OrbitControls target to the loaded robot AFTER it's loaded and positioned
            if (orbitControls) {
                orbitControls.target.copy(robotMesh.position); // Target the initial visual position
                orbitControls.update(); // Ensure the control updates its state
                console.log("OrbitControls target updated to loaded robot position.");
            }

            // Create physics for robot AFTER model is loaded
            createRobotPhysics();
        },
        // called while loading is progressing
        function (xhr) {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        // called when loading has errors
        function (error) {
            console.error('An error happened loading the GLB model:', error);
        }
    );
}

// New function to create robot physics as a vehicle
function createRobotPhysics() {
    console.log("Creating robot physics with vehicle constraint for tracked movement");
    
    // Create a box shape for the robot chassis
    const chassisShape = new CANNON.Box(new CANNON.Vec3(ROBOT_WIDTH / 2, ROBOT_HEIGHT / 2, ROBOT_LENGTH / 2));
    
    // Create the robot body
    const initialRotation = new CANNON.Quaternion();
    initialRotation.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI); 
    
    robotBody = new CANNON.Body({
        mass: ROBOT_MASS,
        material: robotMaterial,
        position: new CANNON.Vec3().copy(ROBOT_START_POS),
        quaternion: initialRotation,
        linearDamping: 0.8, 
        angularDamping: 0.95 
    });
    // Add lines for Cannon.js automatic sleep management for robotBody
    robotBody.allowSleep = true;
    robotBody.sleepSpeedLimit = 0.1; // If vel is below this (m/s or rad/s)
    robotBody.sleepTimeLimit = 0.5;  // For this duration (seconds), body sleeps.
    
    // Lower center of mass significantly for better stability
    robotBody.shapeOffsets[0] = new CANNON.Vec3(0, -ROBOT_HEIGHT/4, 0);
    
    // Add shape to body
    robotBody.addShape(chassisShape);
    world.addBody(robotBody);
    
    if (DEBUG_RAYCAST_VEHICLE) {
        // Create vehicle constraint
        robotVehicle = new CANNON.RaycastVehicle({
            chassisBody: robotBody,
            indexRightAxis: 0, // x
            indexUpAxis: 1,    // y
            indexForwardAxis: 2, // z
        });
    }
    
    // Setup wheel options
    const wheelOptions = {
        radius: 0.25,
        directionLocal: new CANNON.Vec3(0, -1, 0), // down
        suspensionStiffness: 25, // Softer suspension to reduce jitter
        suspensionRestLength: 0.3, // Slightly shorter rest length
        frictionSlip: 8,     // Lower friction slip to reduce stick-slip
        dampingRelaxation: 5.0,  // Softer damping
        dampingCompression: 4.8, // Softer damping
        maxSuspensionForce: 100000, // Lower maximum force
        rollInfluence: 0.1,  // Lower roll influence again
        axleLocal: new CANNON.Vec3(1, 0, 0), // left to right
        chassisConnectionPointLocal: new CANNON.Vec3(0, 0, 0), // Will be overridden for each wheel
        customSlidingRotationalSpeed: -10, // Reduced custom sliding rotational speed
        useCustomSlidingRotationalSpeed: true
    };
    
    // Track width and length
    const trackWidth = ROBOT_WIDTH;
    const trackLength = ROBOT_LENGTH * 0.8;
    
    // Add the wheels at the four corners of the tracks
    // Front left
    wheelOptions.chassisConnectionPointLocal.set(-trackWidth/2, -ROBOT_HEIGHT/2 + 0.1, trackLength/2);
    robotVehicle.addWheel(wheelOptions);
    
    // Front right
    wheelOptions.chassisConnectionPointLocal.set(trackWidth/2, -ROBOT_HEIGHT/2 + 0.1, trackLength/2);
    robotVehicle.addWheel(wheelOptions);
    
    // Rear left
    wheelOptions.chassisConnectionPointLocal.set(-trackWidth/2, -ROBOT_HEIGHT/2 + 0.1, -trackLength/2);
    robotVehicle.addWheel(wheelOptions);
    
    // Rear right
    wheelOptions.chassisConnectionPointLocal.set(trackWidth/2, -ROBOT_HEIGHT/2 + 0.1, -trackLength/2);
    robotVehicle.addWheel(wheelOptions);
    
    // Add middle wheels for better track simulation
    // Middle left
    wheelOptions.chassisConnectionPointLocal.set(-trackWidth/2, -ROBOT_HEIGHT/2 + 0.1, 0);
    robotVehicle.addWheel(wheelOptions);
    
    // Middle right
    wheelOptions.chassisConnectionPointLocal.set(trackWidth/2, -ROBOT_HEIGHT/2 + 0.1, 0);
    robotVehicle.addWheel(wheelOptions);
    
    robotVehicle.addToWorld(world);
    
    // Create the wheel bodies
    const wheelBodies = [];
    for (let i = 0; i < robotVehicle.wheelInfos.length; i++) {
        const wheel = robotVehicle.wheelInfos[i];
        const cylinderShape = new CANNON.Cylinder(wheel.radius, wheel.radius, wheel.radius / 2, 20);
        const wheelBody = new CANNON.Body({
            mass: 0,
            type: CANNON.Body.KINEMATIC,
            material: robotMaterial
        });
        wheelBody.collisionFilterGroup = 0;
        const quaternion = new CANNON.Quaternion();
        quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
        wheelBody.addShape(cylinderShape, new CANNON.Vec3(), quaternion);
        wheelBodies.push(wheelBody);
        world.addBody(wheelBody);
    }
    
    // Listen for collision events
    robotBody.addEventListener("collide", (event) => {
        const collidedBody = event.body;
        const collidedBodyId = collidedBody.id;

        // --- First Blast Door Collision Logic ---
        if (blastDoorBody && !blastDoorBody.userData.isDestroyed) {
            const isFirstDoorPart = collidedBodyId === blastDoorBody.id || 
                                    (firstBlastDoorLeftWallBody && collidedBodyId === firstBlastDoorLeftWallBody.id) ||
                                    (rightWallBody && collidedBodyId === rightWallBody.id);
            if (isFirstDoorPart) {
                let hitObjectName = "First Blast Door structure";
                if (collidedBodyId === blastDoorBody.id) hitObjectName = "First Blast Door";
                else if (firstBlastDoorLeftWallBody && collidedBodyId === firstBlastDoorLeftWallBody.id) hitObjectName = "First Door's Left Wall";
                else if (rightWallBody && collidedBodyId === rightWallBody.id) hitObjectName = "First Door's Right Wall";

                console.log(`COLLISION! Robot collided with ${hitObjectName} (ID: ${collidedBodyId})`);
                if (event.contact) {
                    console.log("  Contact Normal with first door structure:", event.contact.ni); 
                }
                
                blastDoorBody.userData.hitCount++;
                console.log(`First Blast Door structure hit! Count: ${blastDoorBody.userData.hitCount}`);

                if (blastDoorBody.userData.hitCount >= 2) {
                    destroyBlastDoor1(); // Call specific destruction function
                }
            }
        }

        // --- Second Blast Door Collision Logic ---
        if (secondBlastDoorBody && !secondBlastDoorBody.userData.isDestroyed) {
            const isSecondDoorPart = collidedBodyId === secondBlastDoorBody.id || 
                                     (secondBlastDoorLeftWallBody && collidedBodyId === secondBlastDoorLeftWallBody.id) ||
                                     (secondBlastDoorRightWallBody && collidedBodyId === secondBlastDoorRightWallBody.id);
            if (isSecondDoorPart) {
                let hitObjectName = "Second Blast Door structure";
                if (collidedBodyId === secondBlastDoorBody.id) hitObjectName = "Second Blast Door";
                else if (secondBlastDoorLeftWallBody && collidedBodyId === secondBlastDoorLeftWallBody.id) hitObjectName = "Second Door's Left Wall";
                else if (secondBlastDoorRightWallBody && collidedBodyId === secondBlastDoorRightWallBody.id) hitObjectName = "Second Door's Right Wall";

                console.log(`COLLISION! Robot collided with ${hitObjectName} (ID: ${collidedBodyId})`);
                if (event.contact) {
                    console.log("  Contact Normal with second door structure:", event.contact.ni); 
                }
                
                secondBlastDoorBody.userData.hitCount++;
                console.log(`Second Blast Door structure hit! Count: ${secondBlastDoorBody.userData.hitCount}`);

                if (secondBlastDoorBody.userData.hitCount >= 2) {
                    destroyBlastDoor2(); // Call specific destruction function
                }
            }
        }

        // --- Third Blast Door Collision Logic ---
        if (thirdBlastDoorBody && !thirdBlastDoorBody.userData.isDestroyed) {
            const isThirdDoorPart = collidedBodyId === thirdBlastDoorBody.id || 
                                     (thirdBlastDoorLeftWallBody && collidedBodyId === thirdBlastDoorLeftWallBody.id) ||
                                     (thirdBlastDoorRightWallBody && collidedBodyId === thirdBlastDoorRightWallBody.id);
            if (isThirdDoorPart) {
                let hitObjectName = "Third Blast Door structure";
                if (collidedBodyId === thirdBlastDoorBody.id) hitObjectName = "Third Blast Door";
                else if (thirdBlastDoorLeftWallBody && collidedBodyId === thirdBlastDoorLeftWallBody.id) hitObjectName = "Third Door's Left Wall";
                else if (thirdBlastDoorRightWallBody && collidedBodyId === thirdBlastDoorRightWallBody.id) hitObjectName = "Third Door's Right Wall";

                console.log(`COLLISION! Robot collided with ${hitObjectName} (ID: ${collidedBodyId})`);
                if (event.contact) {
                    console.log("  Contact Normal with third door structure:", event.contact.ni); 
                }
                
                thirdBlastDoorBody.userData.hitCount++;
                console.log(`Third Blast Door structure hit! Count: ${thirdBlastDoorBody.userData.hitCount}`);

                if (thirdBlastDoorBody.userData.hitCount >= 2) {
                    destroyBlastDoor3(); // Call specific destruction function
                }
            }
        }
    });
    
    if (DEBUG_RAYCAST_VEHICLE) {
        console.log(`Robot vehicle created with ${robotVehicle.wheelInfos.length} wheels for track simulation`);
    } else {
        console.log("DEBUG: RaycastVehicle disabled – robot body only");
    }
    
    // Now create crane physics since the robot physics is ready
    if (crane && cranetip) {
        createCranePhysics();
    } else {
        console.warn("Crane parts not found yet, crane physics will be created later");
    }
}

// --- Create Physics Bodies for Crane and Cranetip ---
function createCranePhysics() {
    if (!DEBUG_CRANE_PHYSICS) {
        console.warn("DEBUG: Crane physics disabled via DEBUG_CRANE_PHYSICS flag");
        return;
    }
    if (!crane || !cranetip || !robotBody) {
        console.warn("Cannot create crane physics - missing required objects");
        return;
    }

    console.log("Creating physics bodies for crane and cranetip");
    
    // Get the world position and orientation of the crane
    const craneWorldPos = new THREE.Vector3();
    const craneWorldQuat = new THREE.Quaternion();
    crane.getWorldPosition(craneWorldPos);
    crane.getWorldQuaternion(craneWorldQuat);
    
    // Get the world position and orientation of the cranetip
    const cranetipWorldPos = new THREE.Vector3();
    const cranetipWorldQuat = new THREE.Quaternion();
    cranetip.getWorldPosition(cranetipWorldPos);
    cranetip.getWorldQuaternion(cranetipWorldQuat);
    
    // Create crane physics body - switch to kinematic to avoid solver tug-of-war
    const craneShape = new CANNON.Box(new CANNON.Vec3(CRANE_WIDTH/2, CRANE_HEIGHT/2, CRANE_LENGTH/2));
    craneBody = new CANNON.Body({
        mass: 0, // Kinematic body (no forces back to chassis)
        type: CANNON.Body.KINEMATIC,
        material: robotMaterial
    });
    craneBody.addShape(craneShape, new CANNON.Vec3(0, CRANE_HEIGHT / 2, 0)); // Offset shape upwards
    // Disable collisions (no collision group or mask) so it doesn't push the robot
    craneBody.collisionFilterGroup = 0;
    craneBody.collisionFilterMask = 0;
    craneBody.position.copy(craneWorldPos);
    craneBody.quaternion.copy(craneWorldQuat);
    world.addBody(craneBody);
    
    // Create cranetip physics body - switch to kinematic
    const cranetipShape = new CANNON.Box(new CANNON.Vec3(CRANETIP_WIDTH/2, CRANETIP_HEIGHT/2, CRANETIP_LENGTH/2));
    cranetipBody = new CANNON.Body({
        mass: 0,
        type: CANNON.Body.KINEMATIC,
        material: robotMaterial
    });
    cranetipBody.addShape(cranetipShape, new CANNON.Vec3(0, CRANETIP_HEIGHT / 2, 0)); // Offset shape upwards
    // Disable collisions (no collision group or mask) so it doesn't push the robot
    cranetipBody.collisionFilterGroup = 0;
    cranetipBody.collisionFilterMask = 0;
    cranetipBody.position.copy(cranetipWorldPos);
    cranetipBody.quaternion.copy(cranetipWorldQuat);
    world.addBody(cranetipBody);
    
    // Add collision listeners to detect when crane parts hit objects (still works with kinematic bodies)
    craneBody.addEventListener("collide", handleCraneCollision);
    cranetipBody.addEventListener("collide", handleCraneCollision);
    
    // Removed point-to-point constraints – crane is now purely kinematic relative to robot
    console.log("Crane and cranetip physics bodies created as kinematic bodies (no constraints)");
}

// --- Handle Crane Collision Events ---
function handleCraneCollision(event) {
    // When crane collides with something, log it
    console.log("CRANE COLLISION DETECTED!", event.body);
    
    // Only stop the robot if collision is with certain objects (like the blast door)
    if (event.body === blastDoorBody) {
        console.log("Crane hit the blast door - robot movement restricted");
        // Could apply a stopping force to the robot here if needed
    }
    
    if (event.contact) {
        console.log("  Contact Normal:", event.contact.ni);
        
        // Get collision impulse to determine impact strength
        const impulse = event.contact.getImpactVelocityAlongNormal();
        console.log("  Impact velocity:", impulse);
        
        // If strong collision, restrict robot movement temporarily
        if (Math.abs(impulse) > 1) {
            // Apply opposing force to prevent further movement in this direction
            const normalForce = new CANNON.Vec3().copy(event.contact.ni).scale(5000);
            robotBody.applyForce(normalForce, robotBody.position);
        }
    }
}

// --- Obstacle Creation ---
function createObstacles() {
    console.log("createObstacles() called.");
    const tunnelWidth = 0.7; // Use the current tunnel width
    const sandbagDepth = 0.3; // Diameter/Depth of the sandbag
    const sandbagRadius = sandbagDepth / 2;
    const sandbagMaterial = new THREE.MeshStandardMaterial({ color: 0xBC987E }); // Tan/sand color

    // Sandbag 1 (20cm height at Z=50)
    const sb1Height = 0.2;
    // Use CylinderGeometry for visual shape (radiusTop, radiusBottom, height, radialSegments)
    // Note: Cylinder height corresponds to sandbag length (tunnelWidth)
    // We'll use sb1Height for the cylinder radius to control its visual height.
    const sb1Geo = new THREE.CylinderGeometry(sb1Height / 2, sb1Height / 2, tunnelWidth, 16);
    const sb1Mesh = new THREE.Mesh(sb1Geo, sandbagMaterial);
    sb1Mesh.position.set(0, sb1Height / 2, 50);
    sb1Mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2); // Rotate to lie flat along Z
    sb1Mesh.castShadow = true;
    sb1Mesh.receiveShadow = true;
    scene.add(sb1Mesh);

    // Physics shape remains a Box approximation for simplicity
    const sb1Shape = new CANNON.Box(new CANNON.Vec3(tunnelWidth / 2, sb1Height / 2, sb1Height / 2));
    const sb1Body = new CANNON.Body({ mass: 0, material: concreteMaterial }); // Static obstacle
    sb1Body.addShape(sb1Shape);
    sb1Body.position.copy(sb1Mesh.position); 
    world.addBody(sb1Body);
    console.log(`Sandbag 1 (h=${sb1Height}m) added at Z=${sb1Mesh.position.z}.`);

    // Sandbag 2 (30cm height at Z=47)
    const sb2Height = 0.3;
    const sb2Geo = new THREE.CylinderGeometry(sb2Height / 2, sb2Height / 2, tunnelWidth, 16);
    const sb2Mesh = new THREE.Mesh(sb2Geo, sandbagMaterial);
    sb2Mesh.position.set(0, sb2Height / 2, 47);
    sb2Mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2); // Rotate to lie flat along Z
    sb2Mesh.castShadow = true;
    sb2Mesh.receiveShadow = true;
    scene.add(sb2Mesh);

    const sb2Shape = new CANNON.Box(new CANNON.Vec3(tunnelWidth / 2, sb2Height / 2, sb2Height / 2));
    const sb2Body = new CANNON.Body({ mass: 0, material: concreteMaterial }); // Static obstacle
    sb2Body.addShape(sb2Shape);
    sb2Body.position.copy(sb2Mesh.position);
    world.addBody(sb2Body);
    console.log(`Sandbag 2 (h=${sb2Height}m) added at Z=${sb2Mesh.position.z}.`);

    // --- Wooden Plank Pile (Uneven) ---
    console.log("Creating wooden plank pile...");
    const pileCenterX = 0;
    const pileCenterZ = 45; // 2m after sandbag 2
    const pileMaxHeight = 0.5;
    const pileDepth = 0.8; // How far the pile extends along Z
    const pileWidth = tunnelWidth; // Span the tunnel
    const numPlanks = 15;
    const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown/wood color

    for (let i = 0; i < numPlanks; i++) {
        // Random dimensions (within limits)
        const plankHeight = Math.random() * 0.03 + 0.02; // 2cm - 5cm
        const plankWidth = Math.random() * 0.1 + 0.05;   // 5cm - 15cm (depth along Z)
        const plankLength = pileWidth * (Math.random() * 0.3 + 0.7); // 70% - 100% of tunnel width

        // Random position within pile volume
        // Ensure planks are mostly within the lower part of the pile height for density
        const randomY = Math.random() * pileMaxHeight * 0.8; // Place mostly in lower 80%
        const randomX = (Math.random() - 0.5) * (pileWidth - plankLength); // Center variation
        const randomZ = pileCenterZ + (Math.random() - 0.5) * (pileDepth - plankWidth);

        // Create Mesh
        const plankGeo = new THREE.BoxGeometry(plankLength, plankHeight, plankWidth);
        const plankMesh = new THREE.Mesh(plankGeo, woodMaterial);
        plankMesh.position.set(pileCenterX + randomX, randomY + plankHeight / 2, randomZ);

        // Random rotation (small angles)
        plankMesh.rotation.x = (Math.random() - 0.5) * Math.PI / 16; // Small pitch
        plankMesh.rotation.y = (Math.random() - 0.5) * Math.PI / 8;  // Small yaw
        plankMesh.rotation.z = (Math.random() - 0.5) * Math.PI / 16; // Small roll

        plankMesh.castShadow = true;
        plankMesh.receiveShadow = true;
        scene.add(plankMesh);

        // Create Physics Body (Static)
        const plankShape = new CANNON.Box(new CANNON.Vec3(plankLength / 2, plankHeight / 2, plankWidth / 2));
        const plankBody = new CANNON.Body({ mass: 0, material: concreteMaterial });
        plankBody.addShape(plankShape);
        plankBody.position.copy(plankMesh.position);
        plankBody.quaternion.copy(plankMesh.quaternion);
        world.addBody(plankBody);
    }
    console.log(`Created ${numPlanks} planks centered around Z=${pileCenterZ}.`);

    // --- Fallen Concrete Slabs ---
    console.log("Creating fallen concrete slabs...");
    const slabLength = 1.4; // Length of the slab (height when standing)
    const slabWidth = 0.5;  // Width of the slab (how far it extends along Z)
    const slabThickness = 0.05; // Thickness of the slab
    const placementZ = 40;   // Z position of the obstacle center
    const baseHalfWidth = 0.25; // <<< Increased: How far the base of each slab is from the center line (X=0)
    const horizontalShift = 0.27; // <<< Amount to shift the entire structure horizontally

    // Basic calculations for positioning and angle
    const apexHeight = Math.sqrt(slabLength*slabLength - baseHalfWidth*baseHalfWidth);
    const angleFromVertical = Math.asin(baseHalfWidth / slabLength); // Angle the slab leans from vertical

    console.log(`  Slab Params: L=${slabLength}, W=${slabWidth}, T=${slabThickness}, Z=${placementZ}`);
    console.log(`  Calculated: Base Half Width=${baseHalfWidth.toFixed(2)}, Apex Height=${apexHeight.toFixed(2)}, Angle=${(angleFromVertical * 180 / Math.PI).toFixed(1)}deg`);

    // Visual Material (can reuse or create new)
    const slabVisualMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 }); // <<< Changed to black
    // Physics Material (reusing existing concrete)
    const slabPhysicsMaterial = concreteMaterial;

    // Geometry/Shape (Thickness along X, Length along Y, Width along Z)
    const slabVisualGeo = new THREE.BoxGeometry(slabThickness, slabLength, slabWidth);
    const slabPhysicsShape = new CANNON.Box(new CANNON.Vec3(slabThickness / 2, slabLength / 2, slabWidth / 2));

    // --- Left Slab ---
    const leftSlabBaseX = -baseHalfWidth + horizontalShift; // <<< Apply shift to base X
    const leftSlabBaseY = slabThickness / 2; // Base position Y (resting on ground)

    // We need to position the *center* of the slab based on its rotation
    // Calculate center offset relative to the base position
    const centerOffsetX = (slabLength / 2) * Math.sin(angleFromVertical); // Horizontal offset from base center due to lean
    const centerOffsetY = (slabLength / 2) * Math.cos(angleFromVertical); // Vertical offset from base center due to lean

    const leftSlabCenterX = leftSlabBaseX + centerOffsetX; // <<< Use shifted base
    const leftSlabCenterY = leftSlabBaseY + centerOffsetY;

    // Mesh
    const leftSlabMesh = new THREE.Mesh(slabVisualGeo, slabVisualMaterial);
    leftSlabMesh.position.set(leftSlabCenterX, leftSlabCenterY, placementZ);
    leftSlabMesh.rotation.z = -angleFromVertical; // Rotate around Z-axis
    leftSlabMesh.castShadow = true;
    leftSlabMesh.receiveShadow = true;
    scene.add(leftSlabMesh);

    // Body
    const leftSlabBody = new CANNON.Body({ mass: 0, material: slabPhysicsMaterial, shape: slabPhysicsShape });
    leftSlabBody.position.set(leftSlabCenterX, leftSlabCenterY, placementZ);
    leftSlabBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), -angleFromVertical); // Rotate around Z-axis
    world.addBody(leftSlabBody);
    console.log(`  Left Slab added at BaseX=${leftSlabBaseX.toFixed(2)}, Center: (${leftSlabCenterX.toFixed(2)}, ${leftSlabCenterY.toFixed(2)})`); // <<< Updated log


    // --- Right Slab ---
    const rightSlabBaseX = baseHalfWidth + horizontalShift; // <<< Apply shift to base X
    const rightSlabBaseY = slabThickness / 2; // Base position Y

    const rightSlabCenterX = rightSlabBaseX - centerOffsetX; // <<< Use shifted base
    const rightSlabCenterY = rightSlabBaseY + centerOffsetY;

    // Mesh
    const rightSlabMesh = new THREE.Mesh(slabVisualGeo, slabVisualMaterial);
    rightSlabMesh.position.set(rightSlabCenterX, rightSlabCenterY, placementZ);
    rightSlabMesh.rotation.z = angleFromVertical; // Rotate around Z-axis
    rightSlabMesh.castShadow = true;
    rightSlabMesh.receiveShadow = true;
    scene.add(rightSlabMesh);

    // Body
    const rightSlabBody = new CANNON.Body({ mass: 0, material: slabPhysicsMaterial, shape: slabPhysicsShape });
    rightSlabBody.position.set(rightSlabCenterX, rightSlabCenterY, placementZ);
    rightSlabBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), angleFromVertical); // Rotate around Z-axis
    world.addBody(rightSlabBody);
    console.log(`  Right Slab added at BaseX=${rightSlabBaseX.toFixed(2)}, Center: (${rightSlabCenterX.toFixed(2)}, ${rightSlabCenterY.toFixed(2)})`); // <<< Updated log

}

// --- Create Scaled Obstacles for Second Large Tunnel ---
function createScaledObstaclesForSecondTunnel(newTunnelCenterX) {
    console.log(`createScaledObstaclesForSecondTunnel() called for tunnel at X=${newTunnelCenterX}.`);
    const scaleFactor = 2.0;

    // Original dimensions from createObstacles for reference and scaling
    const originalTunnelWidth = 0.7; 
    const originalSandbagDepth = 0.3;

    // Scaled dimensions
    const scaledSandbagDepth = originalSandbagDepth * scaleFactor;
    const scaledSandbagRadius = scaledSandbagDepth / 2;
    const sandbagMaterial = new THREE.MeshStandardMaterial({ color: 0xBC987E }); // Original: 0x80604D (Darker Sand color for variety) -> Original Sand Color

    // --- Scaled Sandbag 1 ---
    const originalSb1Height = 0.2;
    const scaledSb1Height = originalSb1Height * scaleFactor;
    const scaledSb1Length = originalTunnelWidth * scaleFactor; // This was cylinder height, now scaled length

    const sb1Geo_scaled = new THREE.CylinderGeometry(scaledSb1Height / 2, scaledSb1Height / 2, scaledSb1Length, 16);
    const sb1Mesh_scaled = new THREE.Mesh(sb1Geo_scaled, sandbagMaterial);
    // Position: X=newTunnelCenterX, Y=scaled height/2, Z=original Z
    sb1Mesh_scaled.position.set(newTunnelCenterX, scaledSb1Height / 2, 50); 
    sb1Mesh_scaled.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2); 
    sb1Mesh_scaled.castShadow = true;
    sb1Mesh_scaled.receiveShadow = true;
    scene.add(sb1Mesh_scaled);

    const sb1Shape_scaled = new CANNON.Box(new CANNON.Vec3(scaledSb1Length / 2, scaledSb1Height / 2, scaledSandbagRadius));
    const sb1Body_scaled = new CANNON.Body({ mass: 0, material: concreteMaterial }); 
    sb1Body_scaled.addShape(sb1Shape_scaled);
    sb1Body_scaled.position.copy(sb1Mesh_scaled.position); 
    sb1Body_scaled.quaternion.copy(sb1Mesh_scaled.quaternion); // Ensure physics body has same orientation
    world.addBody(sb1Body_scaled);
    console.log(`Scaled Sandbag 1 (h=${scaledSb1Height}m, l=${scaledSb1Length}m) added at X=${sb1Mesh_scaled.position.x.toFixed(2)}, Z=${sb1Mesh_scaled.position.z}.`);

    // --- Scaled Sandbag 2 ---
    const originalSb2Height = 0.3;
    const scaledSb2Height = originalSb2Height * scaleFactor;
    const scaledSb2Length = originalTunnelWidth * scaleFactor;

    const sb2Geo_scaled = new THREE.CylinderGeometry(scaledSb2Height / 2, scaledSb2Height / 2, scaledSb2Length, 16);
    const sb2Mesh_scaled = new THREE.Mesh(sb2Geo_scaled, sandbagMaterial);
    sb2Mesh_scaled.position.set(newTunnelCenterX, scaledSb2Height / 2, 47); 
    sb2Mesh_scaled.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2); 
    sb2Mesh_scaled.castShadow = true;
    sb2Mesh_scaled.receiveShadow = true;
    scene.add(sb2Mesh_scaled);

    const sb2Shape_scaled = new CANNON.Box(new CANNON.Vec3(scaledSb2Length / 2, scaledSb2Height / 2, scaledSandbagRadius));
    const sb2Body_scaled = new CANNON.Body({ mass: 0, material: concreteMaterial });
    sb2Body_scaled.addShape(sb2Shape_scaled);
    sb2Body_scaled.position.copy(sb2Mesh_scaled.position);
    sb2Body_scaled.quaternion.copy(sb2Mesh_scaled.quaternion);
    world.addBody(sb2Body_scaled);
    console.log(`Scaled Sandbag 2 (h=${scaledSb2Height}m, l=${scaledSb2Length}m) added at X=${sb2Mesh_scaled.position.x.toFixed(2)}, Z=${sb2Mesh_scaled.position.z}.`);

    // --- Scaled Wooden Plank Pile ---
    console.log("Creating scaled wooden plank pile...");
    const originalPileCenterZ = 45;
    const originalPileMaxHeight = 0.5;
    const originalPileDepth = 0.8;
    const originalPileWidth = originalTunnelWidth; // Span the original tunnel width
    const numPlanks = 15; // Keep same number of planks, they will be larger
    const woodMaterial_scaled = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Original: 0x654321 (Darker Wood) -> Original Wood Color

    const scaledPileMaxHeight = originalPileMaxHeight * scaleFactor;
    const scaledPileDepth = originalPileDepth * scaleFactor;
    const scaledPileWidth = originalPileWidth * scaleFactor;

    for (let i = 0; i < numPlanks; i++) {
        // Scaled random dimensions
        const plankHeight_scaled = (Math.random() * 0.03 + 0.02) * scaleFactor;
        const plankWidth_scaled = (Math.random() * 0.1 + 0.05) * scaleFactor;   // This is depth along Z for a plank
        const plankLength_scaled = scaledPileWidth * (Math.random() * 0.3 + 0.7); // Length across the new wider pile span

        // Scaled random position within pile volume
        const randomY_scaled = Math.random() * scaledPileMaxHeight * 0.8; 
        // randomX needs to be relative to the new pile width
        const randomX_offset_scaled = (Math.random() - 0.5) * (scaledPileWidth - plankLength_scaled); 
        const randomZ_offset = (Math.random() - 0.5) * (scaledPileDepth - plankWidth_scaled); // plankWidth_scaled is its Z-depth

        // Create Mesh
        const plankGeo_scaled = new THREE.BoxGeometry(plankLength_scaled, plankHeight_scaled, plankWidth_scaled);
        const plankMesh_scaled = new THREE.Mesh(plankGeo_scaled, woodMaterial_scaled);
        plankMesh_scaled.position.set(
            newTunnelCenterX + randomX_offset_scaled, 
            randomY_scaled + plankHeight_scaled / 2, 
            originalPileCenterZ + randomZ_offset
        );

        // Random rotation (same small angles)
        plankMesh_scaled.rotation.x = (Math.random() - 0.5) * Math.PI / 16;
        plankMesh_scaled.rotation.y = (Math.random() - 0.5) * Math.PI / 8;
        plankMesh_scaled.rotation.z = (Math.random() - 0.5) * Math.PI / 16;

        plankMesh_scaled.castShadow = true;
        plankMesh_scaled.receiveShadow = true;
        scene.add(plankMesh_scaled);

        // Create Physics Body (Static)
        const plankShape_scaled = new CANNON.Box(new CANNON.Vec3(plankLength_scaled / 2, plankHeight_scaled / 2, plankWidth_scaled / 2));
        const plankBody_scaled = new CANNON.Body({ mass: 0, material: concreteMaterial });
        plankBody_scaled.addShape(plankShape_scaled);
        plankBody_scaled.position.copy(plankMesh_scaled.position);
        plankBody_scaled.quaternion.copy(plankMesh_scaled.quaternion);
        world.addBody(plankBody_scaled);
    }
    console.log(`Created ${numPlanks} scaled planks centered around X=${newTunnelCenterX.toFixed(2)}, Z=${originalPileCenterZ}.`);

    // --- Scaled Fallen Concrete Slabs ---
    console.log("Creating scaled fallen concrete slabs...");
    const originalSlabBaseZ = 40; // Z position for the group of slabs
    const numSlabs = 8; // Number of slabs
    const slabMaterial_scaled = new THREE.MeshStandardMaterial({ color: 0x000000 }); // Original: 0xA9A9A9 (Darker Concrete) -> Original Slab Color (Black)

    const originalSlabAreaWidth = originalTunnelWidth; // Area width they are spread in
    const originalSlabAreaDepth = 2.0; // Area depth they are spread in

    const scaledSlabAreaWidth = (originalSlabAreaWidth  - 0.69) * scaleFactor;
    const scaledSlabAreaDepth = originalSlabAreaDepth * scaleFactor;

    for (let i = 0; i < numSlabs; i++) {
        // Scaled random dimensions for each slab
        const slabLength_scaled = (Math.random() * 0.4 + 0.2) * scaleFactor; // Length (x-axis of slab)
        const slabWidth_scaled = (Math.random() * 0.3 + 0.15) * scaleFactor; // Width (z-axis of slab)
        const slabThickness_scaled = (Math.random() * 0.05 + 0.05) * scaleFactor; // Thickness (y-axis of slab)

        // Scaled random position within a defined area in the new tunnel
        const slabX_offset_scaled = (Math.random() - 0.5) * scaledSlabAreaWidth;
        const slabZ_offset = (Math.random() - 0.5) * scaledSlabAreaDepth;
        const slabY_scaled = slabThickness_scaled / 2 + Math.random() * 0.1 * scaleFactor; // Slightly above ground, scaled

        const slabGeo_scaled = new THREE.BoxGeometry(slabLength_scaled, slabThickness_scaled, slabWidth_scaled);
        const slabMesh_scaled = new THREE.Mesh(slabGeo_scaled, slabMaterial_scaled);
        slabMesh_scaled.position.set(
            newTunnelCenterX + slabX_offset_scaled, 
            slabY_scaled, 
            originalSlabBaseZ + slabZ_offset
        );

        // Random orientation
        slabMesh_scaled.rotation.x = (Math.random() - 0.5) * Math.PI / 8;
        slabMesh_scaled.rotation.y = Math.random() * Math.PI * 2;
        slabMesh_scaled.rotation.z = (Math.random() - 0.5) * Math.PI / 8;

        slabMesh_scaled.castShadow = true;
        slabMesh_scaled.receiveShadow = true;
        scene.add(slabMesh_scaled);

        const slabShape_scaled = new CANNON.Box(new CANNON.Vec3(slabLength_scaled / 2, slabThickness_scaled / 2, slabWidth_scaled / 2));
        const slabBody_scaled = new CANNON.Body({ mass: 0, material: concreteMaterial });
        slabBody_scaled.addShape(slabShape_scaled);
        slabBody_scaled.position.copy(slabMesh_scaled.position);
        slabBody_scaled.quaternion.copy(slabMesh_scaled.quaternion);
        world.addBody(slabBody_scaled);
    }
    console.log(`Created ${numSlabs} scaled concrete slabs around X=${newTunnelCenterX.toFixed(2)}, Z=${originalSlabBaseZ}.`);

    // --- New A-Frame Concrete Slab Obstacle ---
    console.log("Creating A-frame concrete slab obstacle...");
    const peakHeight_AFrame = 1.7;
    const baseHalfWidth_AFrame = 1.0; // To make total base 2.0m, fitting the tunnel
    const slabLength_AFrame = Math.sqrt(Math.pow(baseHalfWidth_AFrame, 2) + Math.pow(peakHeight_AFrame, 2));
    const slabThickness_AFrame = 0.15;
    const slabDepth_AFrame = 1.0; // Depth along the Z-axis of the tunnel
    const obstacleZ_AFrame = 30; // Z position for this obstacle

    const slabMaterial_AFrame = new THREE.MeshStandardMaterial({ color: 0x000000 }); // Black, same as other scaled slabs

    // Calculate angle for rotation
    // Angle of the slab with the Z-axis if standing on Y-X plane, for rotation around Y.
    // We want the angle the slab (its length along its local Y) makes with the *vertical* Y-axis, when its base is on X and peak towards center.
    // Or rather, the angle its *face* makes with the ground if its thickness is along X, length along Y.
    // Let's use the angle the slab's length makes with the horizontal X-axis (ground).
    const angle_AFrame_rotation = Math.atan2(peakHeight_AFrame, baseHalfWidth_AFrame); // Angle of the slope

    // --- Left Slab of A-Frame ---
    // Geometry: Thickness along X, Length along Y, Depth along Z (tunnel axis)
    const slabGeo_AFrame = new THREE.BoxGeometry(slabThickness_AFrame, slabLength_AFrame, slabDepth_AFrame);
    const leftSlabMesh_AFrame = new THREE.Mesh(slabGeo_AFrame, slabMaterial_AFrame);
    
    // Position the center of the slab.
    // The slab's length is its local Y. We rotate it around its local Z axis.
    leftSlabMesh_AFrame.position.set(
        newTunnelCenterX + 0.5 - baseHalfWidth_AFrame / 2, // Center X of this slab
        peakHeight_AFrame / 2,                     // Center Y of this slab
        obstacleZ_AFrame                           // Z position of the obstacle
    );
    // Rotation around Z axis of the mesh object
    leftSlabMesh_AFrame.rotation.z = Math.PI - angle_AFrame_rotation; // For V-shape (original was angle_AFrame_rotation for A-shape)
    leftSlabMesh_AFrame.castShadow = true;
    leftSlabMesh_AFrame.receiveShadow = true;
    scene.add(leftSlabMesh_AFrame);

    const leftSlabShape_AFrame = new CANNON.Box(new CANNON.Vec3(slabThickness_AFrame / 2, slabLength_AFrame / 2, slabDepth_AFrame / 2));
    const leftSlabBody_AFrame = new CANNON.Body({ mass: 0, material: concreteMaterial });
    leftSlabBody_AFrame.addShape(leftSlabShape_AFrame);
    leftSlabBody_AFrame.position.copy(leftSlabMesh_AFrame.position);
    leftSlabBody_AFrame.quaternion.copy(leftSlabMesh_AFrame.quaternion);
    world.addBody(leftSlabBody_AFrame);

    // --- Right Slab of A-Frame ---
    const rightSlabMesh_AFrame = new THREE.Mesh(slabGeo_AFrame, slabMaterial_AFrame); // Can reuse geometry

    rightSlabMesh_AFrame.position.set(
        newTunnelCenterX + baseHalfWidth_AFrame / 2, // Center X of this slab
        peakHeight_AFrame / 2,                     // Center Y of this slab
        obstacleZ_AFrame                           // Z position of the obstacle
    );
    // Rotation around Z axis of the mesh object (negative of the left slab's angle)
    rightSlabMesh_AFrame.rotation.z = angle_AFrame_rotation; // For V-shape (original was -angle_AFrame_rotation for A-shape)
    rightSlabMesh_AFrame.castShadow = true;
    rightSlabMesh_AFrame.receiveShadow = true;
    scene.add(rightSlabMesh_AFrame);

    const rightSlabShape_AFrame = new CANNON.Box(new CANNON.Vec3(slabThickness_AFrame / 2, slabLength_AFrame / 2, slabDepth_AFrame / 2));
    const rightSlabBody_AFrame = new CANNON.Body({ mass: 0, material: concreteMaterial });
    rightSlabBody_AFrame.addShape(rightSlabShape_AFrame);
    rightSlabBody_AFrame.position.copy(rightSlabMesh_AFrame.position);
    rightSlabBody_AFrame.quaternion.copy(rightSlabMesh_AFrame.quaternion);
    world.addBody(rightSlabBody_AFrame);

    console.log(`Created V-shaped concrete slab obstacle at X=${newTunnelCenterX.toFixed(2)}, Z=${obstacleZ_AFrame} with height ${peakHeight_AFrame}m.`); // Updated log for V-shape

    console.log("createScaledObstaclesForSecondTunnel() finished.");
}

// --- Create Scaled Obstacles for Third Tunnel (1m W x 2m H) ---
function createScaledObstaclesForThirdTunnel(thirdTunnelCenterX) {
    console.log(`createScaledObstaclesForThirdTunnel() called for tunnel at X=${thirdTunnelCenterX}.`);

    const originalTunnelWidth = 0.7; // Width of the very first small tunnel
    const originalTunnelHeight = 1.5; // Approx height of the very first small tunnel
    const newTunnelWidth = 1.0;       // Width of this third tunnel
    const newTunnelHeight = 2.0;      // Height of this third tunnel

    const widthScaleFactor = newTunnelWidth / originalTunnelWidth;   // ~1.428
    const heightScaleFactor = newTunnelHeight / originalTunnelHeight; // ~1.333

    // --- Scaled Sandbag 1 & 2 (for third tunnel) ---
    const originalSandbagDepth = 0.3;
    const scaledSandbagDepth = originalSandbagDepth * widthScaleFactor; // Scale depth with tunnel width changes
    const scaledSandbagRadius = scaledSandbagDepth / 2;
    const sandbagMaterial = new THREE.MeshStandardMaterial({ color: 0xBDAA99 }); // Slightly different sand color

    // Sandbag 1
    const originalSb1Height = 0.2;
    const scaledSb1Height = originalSb1Height * heightScaleFactor;
    const scaledSb1Length = newTunnelWidth; // Span the new tunnel width

    const sb1Geo_t = new THREE.CylinderGeometry(scaledSb1Height / 2, scaledSb1Height / 2, scaledSb1Length, 16);
    const sb1Mesh_t = new THREE.Mesh(sb1Geo_t, sandbagMaterial);
    sb1Mesh_t.position.set(thirdTunnelCenterX, scaledSb1Height / 2, 50); 
    sb1Mesh_t.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2); 
    sb1Mesh_t.castShadow = true; sb1Mesh_t.receiveShadow = true; scene.add(sb1Mesh_t);

    const sb1Shape_t = new CANNON.Box(new CANNON.Vec3(scaledSb1Length / 2, scaledSb1Height / 2, scaledSandbagRadius));
    const sb1Body_t = new CANNON.Body({ mass: 0, material: concreteMaterial, shape: sb1Shape_t });
    sb1Body_t.position.copy(sb1Mesh_t.position); 
    sb1Body_t.quaternion.copy(sb1Mesh_t.quaternion);
    world.addBody(sb1Body_t);
    console.log(`Third Tunnel: Sandbag 1 (h=${scaledSb1Height.toFixed(2)}m, l=${scaledSb1Length.toFixed(2)}m) added.`);

    // Sandbag 2
    const originalSb2Height = 0.3;
    const scaledSb2Height = originalSb2Height * heightScaleFactor;
    const scaledSb2Length = newTunnelWidth; // Span the new tunnel width

    const sb2Geo_t = new THREE.CylinderGeometry(scaledSb2Height / 2, scaledSb2Height / 2, scaledSb2Length, 16);
    const sb2Mesh_t = new THREE.Mesh(sb2Geo_t, sandbagMaterial);
    sb2Mesh_t.position.set(thirdTunnelCenterX, scaledSb2Height / 2, 47); 
    sb2Mesh_t.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    sb2Mesh_t.castShadow = true; sb2Mesh_t.receiveShadow = true; scene.add(sb2Mesh_t);

    const sb2Shape_t = new CANNON.Box(new CANNON.Vec3(scaledSb2Length / 2, scaledSb2Height / 2, scaledSandbagRadius));
    const sb2Body_t = new CANNON.Body({ mass: 0, material: concreteMaterial, shape: sb2Shape_t });
    sb2Body_t.position.copy(sb2Mesh_t.position);
    sb2Body_t.quaternion.copy(sb2Mesh_t.quaternion);
    world.addBody(sb2Body_t);
    console.log(`Third Tunnel: Sandbag 2 (h=${scaledSb2Height.toFixed(2)}m, l=${scaledSb2Length.toFixed(2)}m) added.`);

    // --- Scaled Wooden Plank Pile (for third tunnel) ---
    console.log("Third Tunnel: Creating scaled wooden plank pile...");
    const originalPileCenterZ = 45;
    const originalPileMaxHeight = 0.5;
    const originalPileDepth = 0.8;
    const numPlanks = 15; 
    const woodMaterial_t = new THREE.MeshStandardMaterial({ color: 0x9A6A42 }); // Slightly different wood

    const scaledPileMaxHeight = originalPileMaxHeight * heightScaleFactor;
    const scaledPileDepth = originalPileDepth * widthScaleFactor;
    const scaledPileWidth = newTunnelWidth; // Span the new tunnel width

    for (let i = 0; i < numPlanks; i++) {
        const plankHeight_t = (Math.random() * 0.03 + 0.02) * heightScaleFactor;
        const plankWidth_t = (Math.random() * 0.1 + 0.05) * widthScaleFactor;   // Depth along Z for a plank
        const plankLength_t = scaledPileWidth * (Math.random() * 0.3 + 0.7); 

        const randomY_t = Math.random() * scaledPileMaxHeight * 0.8; 
        const randomX_offset_t = (Math.random() - 0.5) * (scaledPileWidth - plankLength_t); 
        const randomZ_offset = (Math.random() - 0.5) * (scaledPileDepth - plankWidth_t);

        const plankGeo_t = new THREE.BoxGeometry(plankLength_t, plankHeight_t, plankWidth_t);
        const plankMesh_t = new THREE.Mesh(plankGeo_t, woodMaterial_t);
        plankMesh_t.position.set(thirdTunnelCenterX + randomX_offset_t, randomY_t + plankHeight_t / 2, originalPileCenterZ + randomZ_offset);
        plankMesh_t.rotation.set((Math.random() - 0.5) * Math.PI / 16, (Math.random() - 0.5) * Math.PI / 8, (Math.random() - 0.5) * Math.PI / 16);
        plankMesh_t.castShadow = true; plankMesh_t.receiveShadow = true; scene.add(plankMesh_t);

        const plankShape_t = new CANNON.Box(new CANNON.Vec3(plankLength_t / 2, plankHeight_t / 2, plankWidth_t / 2));
        const plankBody_t = new CANNON.Body({ mass: 0, material: concreteMaterial, shape: plankShape_t });
        plankBody_t.position.copy(plankMesh_t.position);
        plankBody_t.quaternion.copy(plankMesh_t.quaternion);
        world.addBody(plankBody_t);
    }
    console.log(`Third Tunnel: Created ${numPlanks} scaled planks.`);

    // --- Scaled Fallen Concrete Slabs (scattered, for third tunnel) ---
    console.log("Third Tunnel: Creating scaled fallen concrete slabs...");
    const originalSlabBaseZ = 40; 
    const numSlabs = 8; 
    const slabMaterial_t = new THREE.MeshStandardMaterial({ color: 0x1A1A1A }); // Darker black

    const scaledSlabAreaWidth = newTunnelWidth * 0.9; // Use 90% of tunnel width for spread
    const scaledSlabAreaDepth = 2.0 * widthScaleFactor; // Scale original spread depth

    for (let i = 0; i < numSlabs; i++) {
        const slabLength_t = (Math.random() * 0.4 + 0.2) * widthScaleFactor; 
        const slabWidth_t = (Math.random() * 0.3 + 0.15) * widthScaleFactor; 
        const slabThickness_t = (Math.random() * 0.05 + 0.05) * heightScaleFactor; 

        const slabX_offset_t = (Math.random() - 0.5) * scaledSlabAreaWidth;
        const slabZ_offset = (Math.random() - 0.5) * scaledSlabAreaDepth;
        const slabY_t = slabThickness_t / 2 + Math.random() * 0.1 * heightScaleFactor; 

        const slabGeo_t = new THREE.BoxGeometry(slabLength_t, slabThickness_t, slabWidth_t);
        const slabMesh_t = new THREE.Mesh(slabGeo_t, slabMaterial_t);
        slabMesh_t.position.set(thirdTunnelCenterX + slabX_offset_t, slabY_t, originalSlabBaseZ + slabZ_offset);
        slabMesh_t.rotation.set((Math.random() - 0.5) * Math.PI / 8, Math.random() * Math.PI * 2, (Math.random() - 0.5) * Math.PI / 8);
        slabMesh_t.castShadow = true; slabMesh_t.receiveShadow = true; scene.add(slabMesh_t);

        const slabShape_t = new CANNON.Box(new CANNON.Vec3(slabLength_t / 2, slabThickness_t / 2, slabWidth_t / 2));
        const slabBody_t = new CANNON.Body({ mass: 0, material: concreteMaterial, shape: slabShape_t });
        slabBody_t.position.copy(slabMesh_t.position);
        slabBody_t.quaternion.copy(slabMesh_t.quaternion);
        world.addBody(slabBody_t);
    }
    console.log(`Third Tunnel: Created ${numSlabs} scaled concrete slabs.`);

    // --- New A-Frame/V-Shape Concrete Slab Obstacle (for third tunnel) ---
    console.log("Third Tunnel: Creating V-shaped concrete slab obstacle...");
    // Proportional to new tunnel: 1m wide, 2m high
    const peakHeight_AFrame_t = newTunnelHeight * 0.75; // e.g., 1.5m for a 2m high tunnel
    const baseTotalWidth_AFrame_t = newTunnelWidth * 0.8; // e.g., 0.8m for a 1m wide tunnel
    const baseHalfWidth_AFrame_t = baseTotalWidth_AFrame_t / 2;

    const slabLength_AFrame_t = Math.sqrt(Math.pow(baseHalfWidth_AFrame_t, 2) + Math.pow(peakHeight_AFrame_t, 2));
    const slabThickness_AFrame_t = 0.10; // Slightly thinner than before
    const slabDepth_AFrame_t = 0.8 * widthScaleFactor; // Depth along Z, scaled
    const obstacleZ_AFrame_t = 30; 

    const slabMaterial_AFrame_t = new THREE.MeshStandardMaterial({ color: 0x101010 }); // Very dark gray/black
    const angle_AFrame_rotation_t = Math.atan2(peakHeight_AFrame_t, baseHalfWidth_AFrame_t);

    const slabGeo_AFrame_t = new THREE.BoxGeometry(slabThickness_AFrame_t, slabLength_AFrame_t, slabDepth_AFrame_t);
    
    // Left Slab of V-Frame
    const leftSlabMesh_AFrame_t = new THREE.Mesh(slabGeo_AFrame_t, slabMaterial_AFrame_t);
    leftSlabMesh_AFrame_t.position.set(thirdTunnelCenterX - baseHalfWidth_AFrame_t / 2, peakHeight_AFrame_t / 2, obstacleZ_AFrame_t);
    leftSlabMesh_AFrame_t.rotation.z = Math.PI - angle_AFrame_rotation_t; 
    leftSlabMesh_AFrame_t.castShadow = true; leftSlabMesh_AFrame_t.receiveShadow = true; scene.add(leftSlabMesh_AFrame_t);
    const leftSlabShape_AFrame_t = new CANNON.Box(new CANNON.Vec3(slabThickness_AFrame_t / 2, slabLength_AFrame_t / 2, slabDepth_AFrame_t / 2));
    const leftSlabBody_AFrame_t = new CANNON.Body({ mass: 0, material: concreteMaterial, shape: leftSlabShape_AFrame_t });
    leftSlabBody_AFrame_t.position.copy(leftSlabMesh_AFrame_t.position);
    leftSlabBody_AFrame_t.quaternion.copy(leftSlabMesh_AFrame_t.quaternion);
    world.addBody(leftSlabBody_AFrame_t);

    // Right Slab of V-Frame
    const rightSlabMesh_AFrame_t = new THREE.Mesh(slabGeo_AFrame_t, slabMaterial_AFrame_t);
    rightSlabMesh_AFrame_t.position.set(thirdTunnelCenterX + baseHalfWidth_AFrame_t / 2, peakHeight_AFrame_t / 2, obstacleZ_AFrame_t);
    rightSlabMesh_AFrame_t.rotation.z = angle_AFrame_rotation_t; 
    rightSlabMesh_AFrame_t.castShadow = true; rightSlabMesh_AFrame_t.receiveShadow = true; scene.add(rightSlabMesh_AFrame_t);
    const rightSlabShape_AFrame_t = new CANNON.Box(new CANNON.Vec3(slabThickness_AFrame_t / 2, slabLength_AFrame_t / 2, slabDepth_AFrame_t / 2));
    const rightSlabBody_AFrame_t = new CANNON.Body({ mass: 0, material: concreteMaterial, shape: rightSlabShape_AFrame_t });
    rightSlabBody_AFrame_t.position.copy(rightSlabMesh_AFrame_t.position);
    rightSlabBody_AFrame_t.quaternion.copy(rightSlabMesh_AFrame_t.quaternion);
    world.addBody(rightSlabBody_AFrame_t);

    console.log(`Third Tunnel: Created V-shaped slab obstacle at X=${thirdTunnelCenterX.toFixed(2)}, Z=${obstacleZ_AFrame_t} with height ${peakHeight_AFrame_t.toFixed(2)}m.`);
    console.log("createScaledObstaclesForThirdTunnel() finished.");
}

// --- Control Setup - Re-enabled ---
function setupControls() {
    window.addEventListener('keydown', (event) => {
        switch (event.key.toLowerCase()) {
            case 'w': controls.forward = true; if (robotBody) robotBody.wakeUp(); break;
            case 's': controls.backward = true; if (robotBody) robotBody.wakeUp(); break;
            case 'a': controls.left = true; if (robotBody) robotBody.wakeUp(); break;
            case 'd': controls.right = true; if (robotBody) robotBody.wakeUp(); break;
            // Arrow keys for camera (do not need to wake robotBody)
            case 'arrowup': controls.arrowUp = true; break;
            case 'arrowdown': controls.arrowDown = true; break;
            case 'arrowleft': controls.arrowLeft = true; break;
            case 'arrowright': controls.arrowRight = true; break;
            // Crane controls - I and K (already have wakeUp)
            case 'i': controls.craneUp = true; if (robotBody) robotBody.wakeUp(); break;
            case 'k': controls.craneDown = true; if (robotBody) robotBody.wakeUp(); break;
            // Crane.001 controls - 6 and 7 (new joint)
            case '6': 
                console.log("crane.001 DOWN (6)");
                controls.crane001Down = true; 
                if (robotBody) robotBody.wakeUp(); 
                break;
            case '7': 
                console.log("crane.001 UP (7)");
                controls.crane001Up = true; 
                if (robotBody) robotBody.wakeUp(); 
                break;
            // Toggle legs fold state & visibility for debugging (already has wakeUp)
            case 'v': 
                legsFolded = !legsFolded;
                console.log("Legs toggled (V). Folded:", legsFolded);
                if (robotBody) robotBody.wakeUp();
                break;
            case 'n': // <<< Fold/Unfold Crane (already has wakeUp)
                craneFolded = !craneFolded;
                console.log("Crane toggled (N). Folded:", craneFolded);
                if (robotBody) robotBody.wakeUp();
                break;
            case 'm': // <<< Fold/Unfold Cranetip (already has wakeUp)
                cranetipFolded = !cranetipFolded;
                console.log("Cranetip toggled (M). Folded:", cranetipFolded);
                if (robotBody) robotBody.wakeUp();
                break;
            // Redundant i/k cases removed as they were already handled above.
        }
    });

    window.addEventListener('keyup', (event) => {
        switch (event.key.toLowerCase()) {
            case 'w': controls.forward = false; break;
            case 's': controls.backward = false; break;
            case 'a': controls.left = false; break;
            case 'd': controls.right = false; break;
            // Arrow keys for camera
            case 'arrowup': controls.arrowUp = false; break;
            case 'arrowdown': controls.arrowDown = false; break;
            case 'arrowleft': controls.arrowLeft = false; break;
            case 'arrowright': controls.arrowRight = false; break;
            // Crane controls
            case 'i': controls.craneUp = false; break;
            case 'k': controls.craneDown = false; break;
            // Crane.001 controls
            case '6': controls.crane001Down = false; break;
            case '7': controls.crane001Up = false; break;
            // No keyup needed for toggles 'v', 'n', 'm'
        }
    });
    console.log("Control event listeners added (including arrow keys, 'v' for legs, 'n'/'m' for crane toggles, 'i'/'k' for crane rotation, '6'/'7' for crane.001 control).");
}

// --- Event Handlers ---
function onWindowResize() {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// --- Apply Controls Logic - Using RaycastVehicle ---
function applyRobotControls() {
    if (!robotVehicle) return;
    
    // Max speeds
    const maxForwardSpeed = 10;
    const maxBackwardSpeed = 2;
    
    // Forward/backward movement
    let engineForce = 0;
    if (controls.forward) {
        engineForce = 300; 
    } else if (controls.backward) {
        engineForce = -200; 
    }

    const isIdle = !controls.forward && !controls.backward && !controls.left && !controls.right;

    // Apply engine force to all wheels or brake if idle
    if (!isIdle) {
        // Apply engine force for forward/backward
        for (let i = 0; i < robotVehicle.wheelInfos.length; i++) {
            robotVehicle.applyEngineForce(engineForce, i);
            robotVehicle.setBrake(0, i); // Ensure brakes are off when applying engine force
        }

        // Steering - use differential steering (tank-like) by applying opposite forces
        if (controls.left || controls.right) {
            const turnForce = 200; // Adjust as needed for turning speed
            for (let i = 0; i < robotVehicle.wheelInfos.length; i++) {
                const isLeftWheel = (i % 2 === 0); // Assuming 0, 2, 4 are left and 1, 3, 5 are right
                if (controls.left && !controls.right) {
                    robotVehicle.applyEngineForce(isLeftWheel ? engineForce - turnForce : engineForce + turnForce, i);
                } else if (controls.right && !controls.left) {
                    robotVehicle.applyEngineForce(isLeftWheel ? engineForce + turnForce : engineForce - turnForce, i);
                }
                // If both or neither, the base engineForce (or 0 if not moving) is already applied.
            }
        }
    } else {
        // IDLE: Apply strong brakes and zero engine force
        for (let i = 0; i < robotVehicle.wheelInfos.length; i++) {
            robotVehicle.applyEngineForce(0, i);
            robotVehicle.setBrake(100, i); // Strong brake force when idle
        }
    }

    // The explicit velocity zeroing IF very slow can stay, it complements the sleep
    if (isIdle && robotBody.velocity.length() < 0.01 && robotBody.angularVelocity.length() < 0.01) { 
        robotBody.velocity.set(0, 0, 0);
        robotBody.angularVelocity.set(0, 0, 0);
    }
    
    // Limit max speed (this part is fine)
    if (robotBody.velocity.length() > maxForwardSpeed) {
        robotBody.velocity.normalize();
        robotBody.velocity.scale(maxForwardSpeed, robotBody.velocity);
    }
}

// --- Camera Control Logic ---
const cameraMoveSpeed = 5.0; // Units per second
const cameraStrafeSpeed = 4.0; // Units per second

function applyCameraControls(deltaTime) {
    if (!camera) return;

    // Get camera's current direction (normalized)
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    // Calculate horizontal forward direction (projection on XZ plane)
    const horizontalDirection = direction.clone();
    horizontalDirection.y = 0;
    horizontalDirection.normalize(); // Normalize to maintain consistent speed

    // Get camera's right vector (normalized)
    const right = new THREE.Vector3();
    right.crossVectors(camera.up, direction).normalize(); // Use original direction for correct right vector

    // Forward/Backward Movement (Horizontal Dolly)
    if (controls.arrowUp) {
        camera.position.addScaledVector(horizontalDirection, cameraMoveSpeed * deltaTime);
        if (orbitControls) orbitControls.target.addScaledVector(horizontalDirection, cameraMoveSpeed * deltaTime);
    }
    if (controls.arrowDown) {
        camera.position.addScaledVector(horizontalDirection, -cameraMoveSpeed * deltaTime);
        if (orbitControls) orbitControls.target.addScaledVector(horizontalDirection, -cameraMoveSpeed * deltaTime);
    }

    // Left/Right Movement (Strafe - uses original 'right' vector which is already horizontal)
    if (controls.arrowLeft) {
        camera.position.addScaledVector(right, -cameraStrafeSpeed * deltaTime);
        if (orbitControls) orbitControls.target.addScaledVector(right, -cameraStrafeSpeed * deltaTime);
    }
    if (controls.arrowRight) {
        camera.position.addScaledVector(right, cameraStrafeSpeed * deltaTime);
        if (orbitControls) orbitControls.target.addScaledVector(right, cameraStrafeSpeed * deltaTime);
    }
}

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate); 

    const deltaTime = Math.min(clock.getDelta(), 0.1); 
    const slerpFactor = Math.min(deltaTime * 5, 1); // Animation speed (adjust 5 for faster/slower)

    // Apply Robot Controls (if vehicle enabled)
    if (DEBUG_RAYCAST_VEHICLE) {
        applyRobotControls();
    }

    // Apply Camera Controls
    applyCameraControls(deltaTime);

    // Step Physics 
    if (world) {
        world.step(1 / 60, deltaTime, 5); // Increased maxSubSteps
    }
    
    // Update wheel positions only when movement keys are pressed to prevent idle jitter
    const robotMoving = controls.forward || controls.backward || controls.left || controls.right;
    if (robotVehicle && robotMoving) {
        robotVehicle.updateVehicle(deltaTime);
    }

    // Synchronize Visuals (robotMesh might be null until loaded)
    if (robotMesh && robotBody) {
        robotMesh.position.copy(robotBody.position);
        robotMesh.quaternion.copy(robotBody.quaternion);
    }

    // --- Debug Leg Animation State ---
    if (legL) {
        // console.log(`animate: legL found. userData keys: ${Object.keys(legL.userData)}`);
    } else {
        // console.log("animate: legL NOT found yet."); // Should only log initially
    }
    // --------------------------------

    // --- Animate Legs --- 
    if (legL && legL.userData.home && legL.userData.fold) {
        const targetL = legsFolded ? legL.userData.fold : legL.userData.home;
        legL.quaternion.slerp(targetL, slerpFactor);
    }
    if (legR && legR.userData.home && legR.userData.fold) {
        const targetR = legsFolded ? legR.userData.fold : legR.userData.home;
        legR.quaternion.slerp(targetR, slerpFactor);
    }
    if (legLB && legLB.userData.home && legLB.userData.fold) { // <<< Animate Leg LB
        const targetLB = legsFolded ? legLB.userData.fold : legLB.userData.home;
        legLB.quaternion.slerp(targetLB, slerpFactor);
    }
    if (legRB && legRB.userData.home && legRB.userData.fold) { // <<< Animate Leg RB
        const targetRB = legsFolded ? legRB.userData.fold : legRB.userData.home;
        legRB.quaternion.slerp(targetRB, slerpFactor);
    }
    // ---------------------
    
    // --- Animate Crane --- // <<< Updated to support both toggle and manual control
    if (crane && crane.userData.home) {
        // Handle N toggle functionality
        if (craneFolded) {
            crane.quaternion.slerp(crane.userData.fold, slerpFactor);
        } else {
            // Handle I/K manual control when not in folded state
            if ((controls.craneUp || controls.craneDown) && !craneFolded) {
                // Update crane angle based on key presses
                if (controls.craneUp) {
                    craneAngle += craneRotationSpeed * deltaTime;
                } else if (controls.craneDown) {
                    craneAngle -= craneRotationSpeed * deltaTime;
                }
                
                // Clamp crane angle to reasonable limits (in radians)
                const maxAngle = Math.PI / 2; // 90 degrees
                craneAngle = Math.max(-maxAngle, Math.min(maxAngle, craneAngle));
                
                // Create a quaternion for the current manual rotation angle
                const manualRotation = new THREE.Quaternion().setFromAxisAngle(
                    new THREE.Vector3(1, 0, 0), craneAngle);
                
                // Apply rotation relative to home position
                const targetQ = crane.userData.home.clone().multiply(manualRotation);
                crane.quaternion.slerp(targetQ, slerpFactor);
            } else if (!craneFolded) {
                // When no key is pressed and not folded, maintain current angle
                const manualRotation = new THREE.Quaternion().setFromAxisAngle(
                    new THREE.Vector3(1, 0, 0), craneAngle);
                const targetQ = crane.userData.home.clone().multiply(manualRotation);
                crane.quaternion.slerp(targetQ, slerpFactor);
            }
        }
        
        // Update crane physics body position and rotation based on visual mesh
        if (DEBUG_CRANE_BODY_UPDATE && craneBody && crane) {
            const worldPos = new THREE.Vector3();
            const worldQuat = new THREE.Quaternion();
            crane.getWorldPosition(worldPos);
            crane.getWorldQuaternion(worldQuat);
            
            // Directly set position and rotation
            // We override physics with visual position to ensure they match
            craneBody.position.copy(worldPos);
            craneBody.quaternion.copy(worldQuat);
            craneBody.velocity.set(0, 0, 0);  // Reset velocity to prevent drift
            craneBody.angularVelocity.set(0, 0, 0);  // Reset angular velocity
        }
    }
    
    // --- Animate Cranetip --- // <<< Updated to support both toggle and manual control
    if (cranetip && cranetip.userData.home) {
        // Handle M toggle functionality
        if (cranetipFolded) {
            cranetip.quaternion.slerp(cranetip.userData.fold, slerpFactor);
        } else {
            // Handle I/K manual control when not in folded state
            if ((controls.craneUp || controls.craneDown) && !cranetipFolded) {
                // Update cranetip angle based on key presses (using the same keys as main crane)
                if (controls.craneUp) {
                    cranetipAngle += craneRotationSpeed * deltaTime;
                } else if (controls.craneDown) {
                    cranetipAngle -= craneRotationSpeed * deltaTime;
                }
                
                // Clamp cranetip angle to reasonable limits
                const maxAngle = Math.PI / 2;
                cranetipAngle = Math.max(-maxAngle, Math.min(maxAngle, cranetipAngle));
                
                // Create a quaternion for the current manual rotation angle
                const manualRotation = new THREE.Quaternion().setFromAxisAngle(
                    new THREE.Vector3(1, 0, 0), cranetipAngle);
                
                // Apply rotation relative to home position
                const targetQ = cranetip.userData.home.clone().multiply(manualRotation);
                cranetip.quaternion.slerp(targetQ, slerpFactor);
            } else if (!cranetipFolded) {
                // When no key is pressed and not folded, maintain current angle
                const manualRotation = new THREE.Quaternion().setFromAxisAngle(
                    new THREE.Vector3(1, 0, 0), cranetipAngle);
                const targetQ = cranetip.userData.home.clone().multiply(manualRotation);
                cranetip.quaternion.slerp(targetQ, slerpFactor);
            }
        }
        
        // Update cranetip physics body position and rotation based on visual mesh
        if (DEBUG_CRANE_BODY_UPDATE && cranetipBody && cranetip) {
            const worldPos = new THREE.Vector3();
            const worldQuat = new THREE.Quaternion();
            cranetip.getWorldPosition(worldPos);
            cranetip.getWorldQuaternion(worldQuat);
            
            // Directly set position and rotation
            // We override physics with visual position to ensure they match
            cranetipBody.position.copy(worldPos);
            cranetipBody.quaternion.copy(worldQuat);
            cranetipBody.velocity.set(0, 0, 0);  // Reset velocity to prevent drift
            cranetipBody.angularVelocity.set(0, 0, 0);  // Reset angular velocity
        }
    }
    
    // --- Animate Crane.001 --- // <<< New joint control with 6/7 keys
    if (crane001 && crane001.userData.home) {
        // Handle crane.001 manual control with 6/7 keys
        if ((controls.crane001Up || controls.crane001Down)) {
            // Update crane001 angle based on key presses
            if (controls.crane001Up) {
                crane001Angle += craneRotationSpeed * deltaTime;
            } else if (controls.crane001Down) {
                crane001Angle -= craneRotationSpeed * deltaTime;
            }
            
            // Clamp crane001 angle to reasonable limits (in radians)
            const maxAngle = Math.PI / 2; // 90 degrees
            crane001Angle = Math.max(-maxAngle, Math.min(maxAngle, crane001Angle));
            
            // Create a quaternion for the current manual rotation angle
            const manualRotation = new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(0, 1, 0), crane001Angle); // Y-axis rotation
            
            // Apply rotation relative to home position
            const targetQ = crane001.userData.home.clone().multiply(manualRotation);
            crane001.quaternion.slerp(targetQ, slerpFactor);
        } else {
            // When no key is pressed, maintain current angle
            const manualRotation = new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(0, 1, 0), crane001Angle); // Use same Y-axis
            const targetQ = crane001.userData.home.clone().multiply(manualRotation);
            crane001.quaternion.slerp(targetQ, slerpFactor);
        }
    }
    // -------------------------

    // Update Orbit Controls
    if (orbitControls) {
        orbitControls.update(); // Required if damping or auto-rotate is enabled
    }

    // Render 
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    } 
}

// --- Start ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded event fired - Final."); // Final log message
    const canvas = document.getElementById('simulationCanvas');
    if (!canvas) {
        console.error("Canvas element with ID 'simulationCanvas' not found!");
        return;
    }
    console.log("Canvas element found:", canvas);
    if (typeof THREE !== 'undefined' && typeof CANNON !== 'undefined') {
         console.log("THREE and CANNON libraries seem loaded. Calling init().");
        init();
        addLogoToScreen(); // <<< Call the function to add the logo
        createTeleportButton(); // <<< Call the function to add the teleport button
        createTeleportButtonTunnel3(); // <<< Call to add teleport for tunnel 3
    } else {
        console.error("Required libraries (THREE or CANNON) not defined.");
        if (typeof THREE === 'undefined') console.error("THREE is undefined");
        if (typeof CANNON === 'undefined') console.error("CANNON is undefined");
    }
});

/* Original start code - commented out */
// if (typeof THREE !== 'undefined' && typeof CANNON !== 'undefined') {
//     init();
// } else {
//     console.error("Three.js or Cannon.js failed to load.");
// } 