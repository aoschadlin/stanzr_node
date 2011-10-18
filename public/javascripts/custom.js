function chatTemplate(listItem, chat) {
    listItem.find('.item_img').html(chat.image);
    listItem.find('.item_msg').text(chat.msg);
    return listItem;
};

$(document).ready(function() {
    $('#addChat').click(function() {
        var newLineItem = $('#chats .template').clone().removeClass('template');
        var testChat = {
          image : "<img src='http://a1.twimg.com/profile_images/635296221/andre_picture_normal.jpeg' />",
          msg : 'Welcome home everyone!'
        };
        chatTemplate(newLineItem, testChat)
            .appendTo('#chats')
            .hide()
            .fadeIn('slow');
        $('#postsarea').animate({ scrollTop: $('#postsarea').prop('scrollHeight') }, 1);
    });
    
    $('#signup_btn').click(function() {
        var continueProcessing = true;
        
        if (! $('#signup_name').val()) {
            $('#signup_name').addClass('mandatory');
            continueProcessing = false;
        } else {
            $('#signup_name').removeClass('mandatory');
        }
        
        if (! $('#signup_pwd').val()) {
            $('#signup_pwd').addClass('mandatory');
            continueProcessing = false;
        } else {
            $('#signup_pwd').removeClass('mandatory');
        }
        
        if (! $('#signup_confirm').val()) {
            $('#signup_confirm').addClass('mandatory');
            continueProcessing = false;
        } else {
            $('#signup_confirm').removeClass('mandatory');
        }
        
        if ($('#signup_pwd').val() != $('#signup_confirm').val()) {
            $('#signup_pwd').addClass('mandatory');
            $('#signup_confirm').addClass('mandatory');
            continueProcessing = false;
        }
        return continueProcessing;
    });
});
