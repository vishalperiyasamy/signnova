import * as tf from '@tensorflow/tfjs';

// Define the body and hand identifiers used by SPOTER
export const BODY_IDENTIFIERS = [
  'nose',
  'left_eye_inner', 'left_eye', 'left_eye_outer',
  'right_eye_inner', 'right_eye', 'right_eye_outer',
  'left_ear', 'right_ear',
  'mouth_left', 'mouth_right',
  'left_shoulder', 'right_shoulder',
  'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist',
  'left_pinky', 'right_pinky',
  'left_index', 'right_index',
  'left_thumb', 'right_thumb',
  'left_hip', 'right_hip',
  'left_knee', 'right_knee',
  'left_ankle', 'right_ankle',
  'left_heel', 'right_heel',
  'left_foot_index', 'right_foot_index'
];

// Define the hand landmarks used by SPOTER
export const HAND_IDENTIFIERS = [
  'wrist',
  'thumb_cmc', 'thumb_mcp', 'thumb_ip', 'thumb_tip',
  'index_finger_mcp', 'index_finger_pip', 'index_finger_dip', 'index_finger_tip',
  'middle_finger_mcp', 'middle_finger_pip', 'middle_finger_dip', 'middle_finger_tip',
  'ring_finger_mcp', 'ring_finger_pip', 'ring_finger_dip', 'ring_finger_tip',
  'pinky_finger_mcp', 'pinky_finger_pip', 'pinky_finger_dip', 'pinky_finger_tip'
];

// MediaPipe pose landmark indices mapping
const POSE_INDICES: Record<string, number> = {
  'nose': 0,
  'left_eye_inner': 1,
  'left_eye': 2,
  'left_eye_outer': 3,
  'right_eye_inner': 4,
  'right_eye': 5,
  'right_eye_outer': 6,
  'left_ear': 7,
  'right_ear': 8,
  'mouth_left': 9,
  'mouth_right': 10,
  'left_shoulder': 11,
  'right_shoulder': 12,
  'left_elbow': 13,
  'right_elbow': 14,
  'left_wrist': 15,
  'right_wrist': 16,
  'left_pinky': 17,
  'right_pinky': 18,
  'left_index': 19,
  'right_index': 20,
  'left_thumb': 21,
  'right_thumb': 22,
  'left_hip': 23,
  'right_hip': 24,
  'left_knee': 25,
  'right_knee': 26,
  'left_ankle': 27,
  'right_ankle': 28,
  'left_heel': 29,
  'right_heel': 30,
  'left_foot_index': 31,
  'right_foot_index': 32
};

// MediaPipe hand landmark indices mapping
const HAND_INDICES: Record<string, number> = {
  'wrist': 0,
  'thumb_cmc': 1,
  'thumb_mcp': 2,
  'thumb_ip': 3,
  'thumb_tip': 4,
  'index_finger_mcp': 5,
  'index_finger_pip': 6,
  'index_finger_dip': 7,
  'index_finger_tip': 8,
  'middle_finger_mcp': 9,
  'middle_finger_pip': 10,
  'middle_finger_dip': 11,
  'middle_finger_tip': 12,
  'ring_finger_mcp': 13,
  'ring_finger_pip': 14,
  'ring_finger_dip': 15,
  'ring_finger_tip': 16,
  'pinky_finger_mcp': 17,
  'pinky_finger_pip': 18,
  'pinky_finger_dip': 19,
  'pinky_finger_tip': 20
};

/**
 * Converts a single frame of MediaPipe landmarks to the format expected by SPOTER
 * @param frame Object containing pose and hand landmarks from MediaPipe
 * @returns Array of landmark coordinates [x, y] for each landmark
 */
export function convertFrameToSPOTERFormat(frame: {
  poseLandmarks?: any[] | null;
  leftHandLandmarks?: any[] | null;
  rightHandLandmarks?: any[] | null;
  landmarks?: any[] | null; // For MediaPipe GestureRecognizer format
  handednesses?: any[] | null; // For MediaPipe GestureRecognizer format
}): number[][] {
  // Initialize landmarks array with zeros
  const landmarks: number[][] = Array(BODY_IDENTIFIERS.length + HAND_IDENTIFIERS.length * 2).fill(0).map(() => [0, 0]);
  
  // Process pose landmarks
  if (frame.poseLandmarks) {
    BODY_IDENTIFIERS.forEach((id, index) => {
      const mpIndex = POSE_INDICES[id];
      if (mpIndex !== undefined && frame.poseLandmarks && frame.poseLandmarks[mpIndex]) {
        landmarks[index] = [
          frame.poseLandmarks[mpIndex].x || 0,
          frame.poseLandmarks[mpIndex].y || 0
        ];
      }
    });
  }
  
  // Process hand landmarks from MediaPipe GestureRecognizer format
  if (frame.landmarks && frame.handednesses) {
    // Determine which hands are present
    const leftHandIndex = frame.handednesses.findIndex(
      hand => hand && hand[0] && hand[0].categoryName === 'Left'
    );
    const rightHandIndex = frame.handednesses.findIndex(
      hand => hand && hand[0] && hand[0].categoryName === 'Right'
    );
    
    // Process left hand if present
    if (leftHandIndex !== -1 && frame.landmarks[leftHandIndex]) {
      const leftHandLandmarks = frame.landmarks[leftHandIndex];
      const leftHandOffset = BODY_IDENTIFIERS.length;
      
      HAND_IDENTIFIERS.forEach((id, index) => {
        const mpIndex = HAND_INDICES[id];
        if (mpIndex !== undefined && leftHandLandmarks[mpIndex]) {
          landmarks[leftHandOffset + index] = [
            leftHandLandmarks[mpIndex].x || 0,
            leftHandLandmarks[mpIndex].y || 0
          ];
        }
      });
    }
    
    // Process right hand if present
    if (rightHandIndex !== -1 && frame.landmarks[rightHandIndex]) {
      const rightHandLandmarks = frame.landmarks[rightHandIndex];
      const rightHandOffset = BODY_IDENTIFIERS.length + HAND_IDENTIFIERS.length;
      
      HAND_IDENTIFIERS.forEach((id, index) => {
        const mpIndex = HAND_INDICES[id];
        if (mpIndex !== undefined && rightHandLandmarks[mpIndex]) {
          landmarks[rightHandOffset + index] = [
            rightHandLandmarks[mpIndex].x || 0,
            rightHandLandmarks[mpIndex].y || 0
          ];
        }
      });
    }
  } else {
    // Process left hand landmarks from direct format
    const leftHandOffset = BODY_IDENTIFIERS.length;
    if (frame.leftHandLandmarks) {
      HAND_IDENTIFIERS.forEach((id, index) => {
        const mpIndex = HAND_INDICES[id];
        if (mpIndex !== undefined && frame.leftHandLandmarks && frame.leftHandLandmarks[mpIndex]) {
          landmarks[leftHandOffset + index] = [
            frame.leftHandLandmarks[mpIndex].x || 0,
            frame.leftHandLandmarks[mpIndex].y || 0
          ];
        }
      });
    }
    
    // Process right hand landmarks from direct format
    const rightHandOffset = BODY_IDENTIFIERS.length + HAND_IDENTIFIERS.length;
    if (frame.rightHandLandmarks) {
      HAND_IDENTIFIERS.forEach((id, index) => {
        const mpIndex = HAND_INDICES[id];
        if (mpIndex !== undefined && frame.rightHandLandmarks && frame.rightHandLandmarks[mpIndex]) {
          landmarks[rightHandOffset + index] = [
            frame.rightHandLandmarks[mpIndex].x || 0,
            frame.rightHandLandmarks[mpIndex].y || 0
          ];
        }
      });
    }
  }
  
  return landmarks;
}

/**
 * Processes a sequence of landmark frames for SPOTER model input
 * @param frames Array of frames containing pose and hand landmarks
 * @param targetLength Target sequence length (default: 30)
 * @returns TensorFlow.js tensor of shape [1, sequence_length, num_landmarks, 2]
 */
export function processLandmarksSequence(
  frames: Array<{
    poseLandmarks?: any[] | null;
    leftHandLandmarks?: any[] | null;
    rightHandLandmarks?: any[] | null;
    landmarks?: any[] | null;
    handednesses?: any[] | null;
  }>,
  targetLength: number = 30
): tf.Tensor4D {
  return tf.tidy(() => {
    // Convert each frame to SPOTER format
    let convertedFrames = frames.map(frame => convertFrameToSPOTERFormat(frame));
    
    // Handle sequence length - pad or truncate to match target length
    if (convertedFrames.length < targetLength) {
      // Pad with the last frame if sequence is too short
      const lastFrame = convertedFrames[convertedFrames.length - 1] || 
                        Array(BODY_IDENTIFIERS.length + HAND_IDENTIFIERS.length * 2).fill(0).map(() => [0, 0]);
      
      while (convertedFrames.length < targetLength) {
        convertedFrames.push([...lastFrame]);
      }
    } else if (convertedFrames.length > targetLength) {
      // Truncate if sequence is too long
      convertedFrames = convertedFrames.slice(0, targetLength);
    }
    
    // Create tensor from converted frames
    const tensor = tf.tensor(convertedFrames);
    
    // Normalize the landmarks
    const normalizedTensor = normalizeLandmarks(tensor);
    
    // Add batch dimension [sequence_length, num_landmarks, 2] -> [1, sequence_length, num_landmarks, 2]
    return tf.expandDims(normalizedTensor, 0) as tf.Tensor4D;
  });
}

/**
 * Normalizes landmarks to be in the range [0, 1]
 * @param tensor Tensor of shape [sequence_length, num_landmarks, 2]
 * @returns Normalized tensor of the same shape
 */
function normalizeLandmarks(tensor: tf.Tensor): tf.Tensor {
  return tf.tidy(() => {
    // Calculate min and max values for x and y coordinates
    const reshapedTensor = tensor.reshape([-1, 2]);
    const min = tf.min(reshapedTensor, 0);
    const max = tf.max(reshapedTensor, 0);
    const range = tf.sub(max, min);
    
    // Avoid division by zero
    const safeRange = tf.where(
      tf.greater(range, tf.scalar(0)),
      range,
      tf.onesLike(range)
    );
    
    // Normalize the landmarks
    const normalized = tf.div(
      tf.sub(reshapedTensor, min),
      safeRange
    );
    
    // Reshape back to original shape
    return normalized.reshape(tensor.shape);
  });
}