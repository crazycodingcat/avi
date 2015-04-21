/*
 *  Global Variable Section
 */

var currentSelectedGalleryImage = null;

var avi = {
    image_url: "",
    image_id: "",
    image_canvas: null,
    image: null,
    roi_startpoint: null,
    roi_endpoint: null,
    ismove: false,
    init: function() {
        //initialization of member variables
        if (currentSelectedGalleryImage !== null) {
            avi.image_id = currentSelectedGalleryImage.attr('id');
        }
        if (avi.image_id != "")
            avi.image_url = "/static/upload/" + avi.image_id;
        avi.image_canvas = document.querySelector("#image-canvas");
        console.log(">>> IMAGEID:", avi.image_url);
        console.log(">>> Image Canvas Dim:", avi.image_canvas.width, avi.image_canvas.height);

        // wireup event listener
        avi.image_canvas.addEventListener("mousedown", avi.image_canvas_mousedown, false);
        avi.image_canvas.addEventListener("mouseup", avi.image_canvas_mouseup, false);
        avi.image_canvas.addEventListener("mousemove", avi.image_canvas_mousemove, false);
        document.querySelector("#analyze-button").addEventListener("click", avi.analyze_button_click, false);
        document.querySelector("#suggest-button").addEventListener("click", avi.suggest_button_click, false);
        document.querySelector("#feedback-good").addEventListener("click", avi.good_button_click, false);
        document.querySelector("#feedback-bad").addEventListener("click", avi.bad_button_click, false);
        document.querySelector("#suggested-defect-type").addEventListener("change", avi.input_custom_type, false);
        // document.querySelector(".btn-file :file").addEventListener("click", avi.thumb_down_button_click, false);

        // draw - images
        avi.roi_startpoint = null;
        avi.roi_endpoint = null;
        if (avi.image_url != "") {
            avi.image = new Image();
            avi.image.onload = function() {
                avi.draw_image_canvas();
            };
            avi.image.src = avi.image_url;
        }
    },
    draw_image_canvas: function() {
        if (avi.image == null) return;
        console.log(">>> drawing image canvas");
        var w = avi.image_canvas.width;
        var h = avi.image_canvas.height;
        var ctx = avi.image_canvas.getContext("2d");
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(avi.image, 0, 0, w, h);

        if (avi.roi_startpoint != null && avi.roi_endpoint != null) {
            ctx.strokeStyle = "#ffd700";
            var roi_x = Math.min(avi.roi_startpoint.x, avi.roi_endpoint.x);
            var roi_y = Math.min(avi.roi_startpoint.y, avi.roi_endpoint.y);
            var roi_w = Math.abs(avi.roi_startpoint.x - avi.roi_endpoint.x);
            var roi_h = Math.abs(avi.roi_startpoint.y - avi.roi_endpoint.y);
            // console.log(">>> roi:", roi_x, roi_y, roi_w, roi_h);
            ctx.strokeRect(roi_x, roi_y, roi_w, roi_h);
        }
    },

    image_canvas_mousedown: function(event) {
        event.preventDefault();
        avi.roi_startpoint = avi.windowToCanvas(avi.image_canvas, event.clientX, event.clientY);
        avi.ismove = true;
        console.log(">>> mousedown", avi.roi_startpoint);
    },
    image_canvas_mouseup: function(event) {
        event.preventDefault();
        avi.roi_endpoint = avi.windowToCanvas(avi.image_canvas, event.clientX, event.clientY);
        avi.draw_image_canvas();
        avi.ismove = false;
        console.log(">>> mouseup", avi.roi_endpoint);
    },
    image_canvas_mousemove: function(event) {
        event.preventDefault();
        if (avi.ismove) {
            avi.roi_endpoint = avi.windowToCanvas(avi.image_canvas, event.clientX, event.clientY);
            avi.draw_image_canvas();
        }
        // console.log(">>> mousemove");
    },
    windowToCanvas: function(canvas, x, y) {
        var bbox = canvas.getBoundingClientRect();
        return {
            x: x - bbox.left * (canvas.width / bbox.width),
            y: y - bbox.top * (canvas.height / bbox.height)
        };
    },
    analyze_button_click: function(event) {
        event.preventDefault();

        // reset table value
        for (var i = 0; i < 3; ++i) {
            $('#td' + i).text('N/A');
            var progressWidth = 'width: 0%';
            $('#tdProgress' + i).attr('style', progressWidth);
            $('#tdSpan' + i).text('0%');
        }

        console.log('>>> analyze btn clicked');
        var url = window.location.href;
        var wratio = avi.image.width / avi.image_canvas.width;
        var hratio = avi.image.height / avi.image_canvas.height;
        var roi_x = Math.min(avi.roi_startpoint.x, avi.roi_endpoint.x);
        var roi_y = Math.min(avi.roi_startpoint.y, avi.roi_endpoint.y);
        var roi_w = Math.abs(avi.roi_startpoint.x - avi.roi_endpoint.x);
        var roi_h = Math.abs(avi.roi_startpoint.y - avi.roi_endpoint.y);
        if (avi.roi_startpoint == null || avi.roi_endpoint == null) {
            return;
        }
        var data = {
            image_id: avi.image_id,
            row: parseInt(roi_y * hratio),
            col: parseInt(roi_x * wratio),
            nr: parseInt(roi_h * hratio),
            nc: parseInt(roi_w * wratio)
        };
        console.log(">>> analyze button clicked:", url, avi.image.width, avi.image.height);
        $.ajax({
            type: "POST",
            url: "/analyze-roi",
            data: data,
            dataType: "json",
            success: function(data) {
                avi.update_defects(data);
                // $("#confirm-button").removeClass("disabled");
                // $("#thumb-down-button").removeClass("disabled");
                $("#feedback-success").hide();
                $("#suggest-div").hide();
            }
        });
    },
    update_defects: function(data) {
        var defects = data.defects
        var patch_id = data.patch_id
        console.log(defects);

        // var html = "<thead> <tr> <th>Defect type</th> <th>Probability</th> <tbody>";

        for (var i = 0; i < defects.length; ++i) {
            var defect = defects[i];
            console.log(defect.type, defect.probability);
            $('#td' + i).text(defect.type);
            var proVal = defect.probability * 100;
            proVal = proVal.toFixed(2)
            console.log(i);
            var progressWidth = 'width:' + proVal + '%';
            $('#tdProgress' + i).attr('style', progressWidth);
            $('#tdSpan' + i).text(proVal);
        }
        // html += "</tbody> </table>";
        $("#defects").data("patch-id", patch_id).data("prediction", defects[0].type);
        // $("#defects>tbody>tr:first").addClass("text-success");
        console.log("patch_id:", $("#defects").data("patch-id"));
        // $("#thumbs").show();
    },
    input_custom_type: function(event) {
        event.preventDefault();
        if ($("#suggested-defect-type option:selected").text() === "custom type") {
            console.log("custom");
            $("#custom-type").show();
        }
    }

    ,
    suggest_button_click: function(event) {
        event.preventDefault();
        console.log("feedback button clicked");
        var wratio = avi.image.width / avi.image_canvas.width;
        var hratio = avi.image.height / avi.image_canvas.height;
        var roi_x = Math.min(avi.roi_startpoint.x, avi.roi_endpoint.x);
        var roi_y = Math.min(avi.roi_startpoint.y, avi.roi_endpoint.y);
        var roi_w = Math.abs(avi.roi_startpoint.x - avi.roi_endpoint.x);
        var roi_h = Math.abs(avi.roi_startpoint.y - avi.roi_endpoint.y);
        var defect = "";
        if ($("#suggested-defect-type option:selected").text() === "custom type") {
            defect = $("#custom-type").val();
        } else {
            defect = $("#suggested-defect-type option:selected").text();
        }

        var data = {
            patch_id: $("#defects").data("patch-id"),
            defect_type: defect,
            image_id: avi.image_id,
            row: parseInt(roi_y * hratio),
            col: parseInt(roi_x * wratio),
            nr: parseInt(roi_h * hratio),
            nc: parseInt(roi_w * wratio),
            byhuman: true
        };
        $.ajax({
            type: "POST",
            url: "/feedback",
            data: data
            // , dataType: "application/json"
            ,
            success: function(data) {
                console.log("successful feedback: ", data);
                $("#feedback-success").alert();
                $("#feedback-success").fadeTo(2000, 500).slideUp(500, function() {
                    $("feedback-success").alert('close');
                });
            }
        });
    }

    ,
    good_button_click: function(event) {
        // event.preventDefault();
        console.log("confirm button clicked");
        var wratio = avi.image.width / avi.image_canvas.width;
        var hratio = avi.image.height / avi.image_canvas.height;
        var roi_x = Math.min(avi.roi_startpoint.x, avi.roi_endpoint.x);
        var roi_y = Math.min(avi.roi_startpoint.y, avi.roi_endpoint.y);
        var roi_w = Math.abs(avi.roi_startpoint.x - avi.roi_endpoint.x);
        var roi_h = Math.abs(avi.roi_startpoint.y - avi.roi_endpoint.y);
        var data = {
            patch_id: $("#defects").data("patch-id"),
            defect_type: $("#defects").data("prediction"),
            image_id: avi.image_id,
            row: parseInt(roi_y * hratio),
            col: parseInt(roi_x * wratio),
            nr: parseInt(roi_h * hratio),
            nc: parseInt(roi_w * wratio),
            byhuman: false
        };
        console.log(">>> confirm", data);
        $.ajax({
            type: "POST",
            url: "/feedback",
            data: data,
            dataType: "json",
            success: function(data) {
                console.log(">>> successful feedback: ", data);
                $("#feedback-success").alert();
                $("#feedback-success").fadeTo(2000, 500).slideUp(500, function() {
                    $("feedback-success").alert('close');
                });
                // $("#thumb-down-button").addClass("disabled");
                // $("#confirm-button").addClass("disabled");
            }
        });
    },
    bad_button_click: function(event) {
        event.preventDefault();
        $("#suggest-div").show();
        // $("#confirm-button").addClass("disabled");
        // $("#thumb-down-button").addClass("disabled");
    }
};

$(function() {
    avi.init();

    // load initial gallery images
    $.ajax({
        type: 'GET',
        url: '/get_gallery',
        success: function(data) {
            // console.log(data);
            displayImages(jQuery.parseJSON(data));
        },
    });

    // reset table value
    var resetTableValue = function() {
      for (var i = 0; i < 3; ++i) {
          $('#td' + i).text('N/A');
          var progressWidth = 'width: 0%';
          $('#tdProgress' + i).attr('style', progressWidth);
          $('#tdSpan' + i).text('0%');
      }
    };

    resetTableValue();


    // Hide image upload progress bar
    $('#site-image-gallery-progress').hide();
    $('.btn-file :file').on('fileselect', function(event, numFiles, label) {
        var input = $(this).parents('.input-group').find(':text'),
            log = numFiles > 1 ? numFiles + ' files selected' : label;

        if (input.length) {
            input.val(log);
        } else {
            if (log) alert(log);
        }
        console.log(numFiles);
        console.log(label);
    });

    /*
     *  Site Control Script Seciton
     */

    // Show hide Site Images Gallery Bar
    $('#site-control-toggleMenu').on('click', function() {
        $('.site-image-inspection').toggleClass('col-xs-8');
        $('.site-image-gallery').toggleClass('hidden');
        $(this).toggleText('Show Menu', 'Hide Menu');
    });

    // Create Site Images Gallery Placeholder Images
    // Load 10 images in each set
    var displayImages = function(urlArray) {
        for (url in urlArray) {
            var image = $('#site-image-gallery-origin-image')
                .removeClass('sr-only')
                .clone();
            var imageURL = urlArray[url].url;
            var imageName = urlArray[url].fileName;

            image.find('.site-gallery-display-image')
                .attr('src', imageURL)
                .attr('id', imageName);
            image.find('.site-image-gallery-fileName').text(imageName);
            $('.site-image-gallery-display-images')
                .append(image);
        }
    };

    // Highlight Gallery Selection
    var highlightBorder = function(imageElement) {
        imageElement.css('border', '5px solid #064A8E');
    }

    $('.site-image-gallery-display-images').on('click', '.site-gallery-display-image', function() {
        console.log('>>> image click');
        if (currentSelectedGalleryImage !== null) {
            currentSelectedGalleryImage.css('border', '');
        }
        currentSelectedGalleryImage = $(this);
        avi.init();
        updateCurrentFileName();
        highlightBorder(currentSelectedGalleryImage);
        $('#site-image-inspection-currentImagePlaceholder').addClass('sr-only');
        $('#image-canvas').removeClass('sr-only');
        console.log(currentSelectedGalleryImage);
    });

    // Previous Image button click
    $('#site-inspection-previousImageButton').on('click', function() {
        if (currentSelectedGalleryImage !== null) {
            currentSelectedGalleryImage.css('border', '');
        }
        currentSelectedGalleryImage = currentSelectedGalleryImage.parent().prev().find('.site-gallery-display-image');
        highlightBorder(currentSelectedGalleryImage);
        avi.init();
        updateCurrentFileName();
    });

    // Next Image button click
    $('#site-inspection-nextImageButton').on('click', function() {
        if (currentSelectedGalleryImage !== null) {
            currentSelectedGalleryImage.css('border', '');
        }
        currentSelectedGalleryImage = currentSelectedGalleryImage.parent().next().find('.site-gallery-display-image');
        highlightBorder(currentSelectedGalleryImage);
        avi.init();
        updateCurrentFileName();
    });

    // Site feedback section
    // $('#site-feedback-good').on('click', function(){
    //     $('#site-feedback-thankyou').text('Thank you.');
    //     setTimeout(function() {
    //         $('#site-feedback-thankyou').text('');
    //     }, 1500);
    //     console.log('>>> good btn click');
    //     avi.confirm_button_click();
    // });

    // Show feedback comment box when 'X' click
    // $('#site-feedback-bad').on('click', function() {
    //     console.log('>>> bad btn click');
    //     $('.site-feedback-textbox').removeClass('sr-only');
    // });

    // Hide feedback comment box when feedback selecte
    // $('.site-feedback-textbox').on('change', function() {
    //     $('#site-feedback-thankyou').text('Thank you.');
    //     setTimeout(function() {
    //         $('#site-feedback-thankyou').text('');
    //     }, 1500);
    //     $(this).addClass('sr-only');
    //     avi.feedback_button_click($(this).val());
    // });

    // Upload images confirmed
    $('#site-image-gallery-upload').on('change', function() {
        var elem = document.getElementById("site-image-gallery-upload");
        var names = [];
        for (var i = 0; i < elem.files.length; ++i) {
            names.push(elem.files[i]);
        }
        // clear existing images inside gallery
        // $('.site-image-gallery-display-images').empty();
        // $('#site-image-uploadForm').submit();
        // console.log('>>> files uploading...');
        var form_data = new FormData($('#site-image-uploadForm')[0]);
        $.ajax({
            type: 'POST',
            url: '/upload',
            data: form_data,
            contentType: false,
            cache: false,
            processData: false,
            async: true,
            beforeSend: function() {
                // $("#uploading").show();
                $('#site-image-gallery-progress').show();
            },
            success: function(data) {
                // alert('File uploaded!');
                console.log(data);
                displayImages(jQuery.parseJSON(data));
                $('#site-image-gallery-progress').hide();
            },
            error: function() {
                alert('Upload failed.');
                // $("#uploading").hide();
            }
        });
    });

    var updateCurrentFileName = function() {
        if (currentSelectedGalleryImage !== null) {
            $('#site-iamge-inspection-info-fileName').attr('value', currentSelectedGalleryImage.attr('id'));
        }
    };


});

/*
 *  Helper functions Section
 */

$.fn.toggleText = function(t1, t2) {
    if (this.text() == t1) {
        this.text(t2);
    } else {
        this.text(t1);
    }
    return this;
};