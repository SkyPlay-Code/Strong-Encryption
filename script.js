const fileInput = document.getElementById('file-input');
const encryptButton = document.getElementById('encrypt-button');
const decryptButton = document.getElementById('decrypt-button');
const outputDiv = document.getElementById('output');
const progressBar = document.getElementById('progress-bar-inner');

let fileName;
let encryptedFileName;
let keyHex;
let ivHex;
let encryptedBinaryData;

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  fileName = file.name;
  outputDiv.innerText = `File selected: ${fileName}`;
});

encryptButton.addEventListener('click', async () => {
  if (!fileName) {
    alert('Please select a file first!');
    return;
  }

  try {
    // Generate a random 256-bit key
    const key = await crypto.getRandomValues(new Uint8Array(32));
    keyHex = Array.prototype.map.call(key, (x) => (`00${x.toString(16)}`).slice(-2)).join('');

    // Show the loading bar
    progressBar.style.width = '0%';

    // Generate a random 96-bit IV
    const iv = await crypto.getRandomValues(new Uint8Array(12));
    ivHex = Array.prototype.map.call(iv, (x) => (`00${x.toString(16)}`).slice(-2)).join('');

    // Encrypt the file name using AES-256-GCM
    const encryptedFileName = await encrypt(fileName, keyHex, ivHex);

    // Update the progress bar
    progressBar.style.width = '25%';

    // Convert the encrypted text to UTF-16 binary
    const encryptedBinary = new TextEncoder('utf-16').encode(encryptedFileName);

    // Update the progress bar
    progressBar.style.width = '50%';

    // Encrypt the binary data using the transposition cipher
    const cipheredBinary = transpositionCipher(encryptedBinary, fileName);

    // Update the progress bar
    progressBar.style.width = '75%';

    // Store the encrypted binary data
    encryptedBinaryData = cipheredBinary;

    // Apply the encrypted password to the PDF
    const encryptedPdf = await applyPasswordToPdf(encryptedFileName, fileInput.files[0], fileName);

    // Update the progress bar
    progressBar.style.width = '100%';

    // Create a download link for the password-protected PDF
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(encryptedPdf);
    downloadLink.download = `${fileName}_encrypted.pdf`;
    downloadLink.click();

    // Hide the loading bar
    progressBar.style.width = '0%';

    // Display the encrypted password to the user
    outputDiv.innerText = `
      Encrypted file name (UTF-16 binary): ${Array.prototype.map.call(new Uint8Array(encryptedBinary), (x) => (`00${x.toString(16)}`).slice(-2)).join('')}
      Key: ${keyHex}
      IV: ${ivHex}
      Encrypted password: ${encryptedFileName}
    `;
  } catch (error) {
    console.error('Error encrypting file name:', error);
  }
});

decryptButton.addEventListener('click', async () => {
  if (!encryptedBinaryData || !keyHex || !ivHex) {
    alert('Please encrypt a file first!');
    return;
  }

  try {
    // Decrypt the binary data using the transposition cipher
    const decryptedBinary = transpositionCipher(encryptedBinaryData, fileName);

    // Decrypt the file name using AES-256-GCM
    const decryptedFileName = await decrypt(decryptedBinary, keyHex, ivHex);

    outputDiv.innerText = `Decrypted file name: ${decryptedFileName}`;
  } catch (error) {
    console.error('Error decrypting file name:', error);
  }
});

async function encrypt(plainText, keyHex, ivHex) {
  try {
    const algorithm = {
      name: 'AES-GCM',
      iv: hexToArray(ivHex),
      tagLength: 128, // 128-bit tag length
    };

    const keyObject = await crypto.subtle.importKey(
      'raw',
      hexToArray(keyHex),
      { name: 'AES-GCM', length: 256 }, // 256-bit key size
      true,
      ['encrypt']
    );

    const encrypted = await crypto.subtle.encrypt(algorithm, keyObject, new TextEncoder().encode(plainText));

    return `${ivHex}:${Array.prototype.map.call(new Uint8Array(encrypted), (x) => (`00${x.toString(16)}`).slice(-2)).join('')}`;
  } catch (error) {
    throw new Error(`Error encrypting file name: ${error}`);
  }
}

async function decrypt(encryptedText, keyHex, ivHex) {
    try {
      const [iv, encrypted] = encryptedText.split(':');
      const algorithm = {
        name: 'AES-GCM',
        iv: hexToArray(iv),
        tagLength: 128, // 128-bit tag length
      };
  
      const keyObject = await crypto.subtle.importKey(
        'raw',
        hexToArray(keyHex),
        { name: 'AES-GCM', length: 256 }, // 256-bit key size
        true,
        ['decrypt']
      );
  
      const decrypted = await crypto.subtle.decrypt(algorithm, keyObject, hexToArray(encrypted));
  
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      throw new Error(`Error decrypting file name: ${error}`);
    }
  }
  
  async function applyPasswordToPdf(encryptedPassword, file, fileName) {
    const pdfDoc = await PDFDocument.load(file);
    const totalBytes = pdfDoc.getBytes().length;
    let processedBytes = 0;
  
    // Add a timeout to the function
    const timeout = setTimeout(() => {
      console.error('Timeout: applyPasswordToPdf took too long to complete');
    }, 10000); // 10 seconds
  
    return new Promise((resolve, reject) => {
      pdfDoc.encrypt(encryptedPassword, {
        userPassword: encryptedPassword,
        ownerPassword: encryptedPassword,
        permissions: {
          printing: 'highResolution',
          modifying: false,
          copying: false,
          annotating: false,
          fillingForms: false,
          contentAccessibility: false,
          documentAssembly: false,
        },
        onProgress: (progress) => {
          processedBytes = progress.bytesWritten;
          const progressPercentage = (processedBytes / totalBytes) * 100;
          progressBar.style.width = `${progressPercentage}%`;
        },
      });
  
      pdfDoc.save().then((pdfBytes) => {
        clearTimeout(timeout); // Clear the timeout
        resolve(new Blob([pdfBytes], { type: 'application/pdf' }));
      }).catch((error) => {
        reject(error);
      });
    });
  }
  
      pdfDoc.save().then((pdfBytes) => {
        resolve(new Blob([pdfBytes], { type: 'application/pdf' }));
      }).catch((error) => {
        reject(error);
      });
  
  function hexToArray(hex) {
    return new Uint8Array(hex.match(/.{2}/g).map((byte) => parseInt(byte, 16)));
  }
  
  function transpositionCipher(binaryData, filename) {
    const filenameArray = filename.split('');
    const permutation = filenameArray.map((char) => char.charCodeAt(0) % 256);
  
    const binaryArray = Array.prototype.slice.call(binaryData);
    const cipheredArray = new Array(binaryArray.length);
  
    for (let i = 0; i < binaryArray.length; i++) {
      cipheredArray[(permutation[i % permutation.length] + i) % binaryArray.length] = binaryArray[i];
    }
  
    return new Uint8Array(cipheredArray);
  }