//Obje Belirleme Api Sunucusu
//Burak Can TEMİZEL 180202024
//Ozge Poyraz 180202025

const serverAdress = 'api_adres:4000'; //Google Cloud Compute Engine Server Adresimiz ve Portumuz

const express = require('express'); // Web Sunucusu İçin Express Kütüphanesini Dahil Ediyoruz.

const app = express(); // Express Uygulamasını Başlatıyoruz.

const fileupload = require('express-fileupload'); // Sunucuya Gelecek Görüntüleri Yüklemek İçin Kütüphaneyi Dahil Ediyoruz.

app.use(fileupload()); // Express Uygulamasına Kütüphaneyi Dahil Ediyoruz.

const {
    createCanvas, // Çizim Alanı Oluşturmak İçin Kullanacağımız Fonksiyon.

    loadImage // Resimleri Yüklemek İçin Kullanacağımız Fonksiyon.

} = require('canvas') // Görüntüleri İşlemek Ve Kareleri Çizmek İçin Kütüphaneyi Dahil Ediyoruz.

var sizeOf = require('image-size'); // Görüntü Boyutlarını Ölçmek İçin Kullanacağımız Fonksiyon.

const {
    v4: uuidv4 // Dosyalara Rastgele İsim Atamak İçin Kullanacağımız Fonksiyon.
} = require('uuid'); // Dosyalara Rastgele İsim Atamak İçin Kullanacağımız Kütüphane.

require('dotenv').config() // Sunucunun Ortam Değişkenlerini Ayarlamak İçin Kütüphaneyi Dahil Ediyoruz Ve Ayarlamaları Yapıyoruz.

const fs = require('fs'); // Dosya İşlemleri Yapmak İçin Kütüphaneyi Dahil Ediyoruz.

app.use('/outputs', express.static('outputs')); // İşlenmiş GÖrüntüleri Sunacağımız Klasörü Ayarlıyoruz.
app.use('/uploads', express.static('uploads')); // İşlenmemiş GÖrüntüleri Sunacağımız Klasörü Ayarlıyoruz.

//Google Cloud Vision Kullanılırken 
//https://cloud.google.com/vision/docs/libraries 
//Adresinden faydalanılmış ve referans alınılmıştır.
const vision = require('@google-cloud/vision'); // Google Cloud Vision İstemci Kütüphanesini Dahil Ediyoruz.

const client = new vision.ImageAnnotatorClient(); // İstemci Nesnesini Oluşturuyoruz.

const admin = require('firebase-admin'); // Firebase Firestore için Kütüphaneyi Dahil Ediyoruz.
const serviceAccount = require('./key/googleserviceskey.json'); // Anahtar Dosyamızı Dahil Ediyoruz.

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount) // Anahtar Dosyamızı Kullanarak Firebase Firestore'a bağlantı kuruyoruz.
});

const db = admin.firestore(); // Veritabanı Referansını Alıyoruz.


function randomNumber(max) { //Rastgele Integer Değer Döndüren Fonksiyonumuz.
    return Math.floor(Math.random() * Math.floor(max));
}


//Sunucu Aktifliği İçin Test 200 Statusunde Mesaj Gösteriyor.
app.get("/", (req, res, next) => {
    res.status(200).send("Object Detection Api Sunucusu Çalışıyor.");
});

//Apiye İstek Atılan /upload URLmiz ve Ana İşlemler
app.post("/upload", function (req, res, next) {
    try{
        //Form Bilgisinden Veri Ayıklama
        const file = req.files.photo;
        var fileName = uuidv4();
        var imagePath = "./uploads/" + fileName + ".jpg";

        //Dosyayı Veritabanına Api Storageına kopyalıyoruz. Daha Sonra Tablodan Referans Verilecek
        file.mv(imagePath, function (err, result) {
            if (err){
                 //throw err;
                    res.send({
                    success: false,
                    url: null,
                    count: 0,
                    list: null
                });
                return; //Eğer Depolamaya Atarken Bir Problem Olursa Direkt Olarak Api Bağlantısını Kesiyoruz. Negatif Response Dönüyoruz.
            }

            //Yüklendikten sonra burada tanimlama ve resime dönüştürme yapicaz
            loadImage(imagePath).then(async (image) => {

                //Google Cloud Vision Aoiye Request Atmak İçin Veritabanı Storage'ından Resmi Okuyoruz.
                const request = {
                    image: {
                        content: fs.readFileSync(imagePath)
                    },
                };
            
                const [result] = await client.objectLocalization(request);
                const objects = result.localizedObjectAnnotations;

                //Apiye Request attık ve response olarak objects nesnesini aldık bunun üzerinden resmi işleyeceğiz.

                //Çizimler Ve Resim İşleme
                var dimensions = sizeOf(imagePath);
                const canvas = createCanvas(dimensions.width, dimensions.height);
                const context = canvas.getContext('2d')
                context.fillStyle = '#fff'
                context.fillRect(0, 0, dimensions.width, dimensions.height);
                var dm = sizeOf(imagePath);
                context.drawImage(image, 0, 0, dm.width, dm.height);

                //Oranlamalar
                var fontBase = 1080,                   
                fontSize = 150;                    
                var lineBase = 1080,
                lineWidth = 30;
               
                var lineRatio = lineWidth / lineBase;
                var ratio = fontSize / fontBase;  

                var objectList = "";

                objects.forEach(object => {
                    let red = randomNumber(255);
                    let green = randomNumber(255);
                    let blue = randomNumber(255);
                    let alpha = 1;
                    
            
                    //Her obje için dönüyoruz
                    const vertices = object.boundingPoly.normalizedVertices;

                    var x1 = vertices[0].x * dm.width; //Sol üst köşe X
                    var y1 = vertices[0].y * dm.height; //Sol üst köşe Y
                    var x2 = (vertices[1].x - vertices[0].x) * dm.width; //Genişlik
                    var y2 = (vertices[2].y - vertices[1].y) * dm.height; //Yükseklik
                    //console.log(x1 + " " + y1 + " " + x2 + " " + y2);

                    //Hesaplamalar
                    let measure = x2;
                    var size = measure * ratio;   
                    var lineSize = measure * lineRatio;
                    if(lineSize <= 5){
                        lineSize = 5;
                    }else if(lineSize >= 20){
                        lineSize = 20;
                    }

                    context.lineWidth = lineSize;
                    context.fillStyle = "rgba("+red+","+green+","+blue+","+alpha+")";
                    context.strokeStyle = "rgba("+red+","+green+","+blue+","+alpha+")";
                    context.strokeRect(x1, y1, x2, y2);
                    context.font = (size) + 'px Arial';
                    var textSize = context.measureText(object.name);
                    let actualHeight = textSize.actualBoundingBoxAscent + textSize.actualBoundingBoxDescent;  
                    let offsetX = Math.abs(x2 - textSize.width) / 2;
                    //console.log(vertices[3].x * dm.width + offsetX );
                    //console.log(y1 - offsetY);
                    context.fillText(object.name , x1 + offsetX , y1 + (y2 / 2) + actualHeight/4);

                    objectList += object.name + ",";
                    context.lineWidth = 1;
                    //context.strokeStyle = '#FFFFFF';
                    //context.strokeText(object.name , x1 + offsetX , y1 + (y2 / 2) + actualHeight/4);
                });
                if(objects.length > 0){
                    objectList = objectList.slice(0, -1); //Son virgülü kesiyoruz
                }
                context.fillStyle = "#FFFFFF";
                context.font = (dm.width * ratio) + 'px Arial';
                context.fillText(objects.length + " found.", 0, dm.height);

                //İşlenmiş Resmi Veritabanına Ref Vermek İçin Storage'a Kaydediyoruz.
                var buffer = canvas.toBuffer();
                fs.writeFileSync('./outputs/' + fileName + '.jpg', buffer)

                //Api Response'u 
                res.send({
                    success: true,
                    url: "/outputs/" + fileName + ".jpg",
                    count: objects.length,
                    list: objectList
                });

                console.log("Api tarafından islem gerceklestirildi.");

                //Storagedaki Resimleri Veritabanına Referanslıyoruz.
                //Diğer Obje Bilgilerini de yolluyoruz.
                const objectDetectionRef = db.collection('objectDetection').doc(fileName);
                await objectDetectionRef.set({
                'inputImage': serverAdress + '/uploads/' + fileName + '.jpg',
                'outputImage': serverAdress + '/outputs/' + fileName + '.jpg',
                'objectCount': objects.length,
                'objectList' : objectList,
                });

                
            });

        });
    }catch(err){
        //Herhangi bir hata durumunda Api başarısız bir response dönüyor.
        console.log("Hata: islem basarisiz!");
        res.send({
            success: false,
            url: null,
            count: 0,
            list : null,
        });
        return;
    }
});


//4000 portu üzerinde api server çalışıyor.
const port = process.env.PORT || 4000;

app.listen(port, () => {
    console.log(`${port} -> üzerinde object detection api sunucu çalışıyor`)
});