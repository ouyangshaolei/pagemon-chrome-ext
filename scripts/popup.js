// Returns the URL of the notification record given any element in it.
function getNotificationUrl(context) {
  return $(context).closest('.notification').find('.page_link').attr('href');
}

function openExternalLink() {
  markPageVisited.call(this);
  chrome.tabs.create({ url: this.href, selected: false });
  return false;
}

// Hides a notification record given any element in it.
function markPageVisited() {
  var $this = $(this);
  
  var url = getNotificationUrl(this);
  console.log('Marking visited: ' + url);
  
  setPageSettings(url, { updated: false }, function() {
    BG.updateBadge();
    BG.takeSnapshot(url, BG.scheduleCheck);
    
    console.log('Marked visited; proceeding.');
    $this.closest('.notification td').slideUp('slow', function() {
      if ($('#notifications .notification').length == 1) {
        $('#notifications').animate(
          { height: '50px', opacity: 1 }, 'slow', fillNotifications
        );
      } else {
        fillNotifications();
      }
    });
  });
}

// Mark page as monitored/unmonitored with the relevant label/event changes.
function setPageMonitoredStatus(monitored) {
  if (monitored) {
    $('#monitor_page').unbind('click')
                      .addClass('inactive').removeClass('active').addClass('emphasized')
                      .find('span').text(chrome.i18n.getMessage('page_monitored'));
  } else {
    $('#monitor_page').click(monitorCurrentPage)
                      .removeClass('inactive').addClass('active').removeClass('emphasized')
                      .find('span').text(chrome.i18n.getMessage('monitor'));
  }
}

// Add current page to the monitored list.
function monitorCurrentPage() {
  $('#monitor_page').css('cursor', 'progress');
  chrome.tabs.getSelected(null, function(tab) {
    // If the page is still loading, try a little while later.
    if (tab.status == 'loading') {
      setTimeout(monitorCurrentPage, 100);
    } else {
      addPage({ url: tab.url, name: tab.title, icon: tab.favIconUrl }, function() {
        setPageMonitoredStatus(true);
        $('#monitor_page').css('cursor', 'auto');
      });
    }
  });
}

// Fill the notifications list with notifications for each updated page. If
// no pages are updated, set teh appropriate message.
function fillNotifications(callback) {
  console.log('Filling list.');
  getAllUpdatedPages(function(pages) {
    $('#notifications').html('');
    
    if (pages.length > 0) {
      $.each(pages, function(i, page) {
        var notification = $('#templates .notification').clone();
    
        var name = page.name || chrome.i18n.getMessage('untitled', page.url);
        if (name.length > 60) {
          name = name.replace(/([^]{20,60})(\w)\b.*$/, '$1$2...');
        }
        
        notification.find('.page_link').attr('href', page.url).text(name);
        
        notification.find('.favicon').attr({
          src: page.icon || 'img/page.png'
        });
        
        notification.find('.view_diff').attr({
          href: 'diff.htm#' + btoa(page.url)
        });
      
        notification.appendTo('#notifications');
      });
    } else {
      $('#templates .empty').clone().appendTo('#notifications');
    }
    
    (callback || $.noop)();
  });
}

// Force a check on all pages that are being monitored. Does some complex
// animation to smoothly slide in the current notifications, display a
// loader, then slide out the new notifications.
function checkAllPages() {
  getAllPageURLs(function(pages) {
    // If there are no pages to check, return.
    if (pages.length === 0 ||
        pages.length == $('#notifications .notification').length) {
      return;
    }
    
    // Disable this event handler.
    $('#check_now').unbind('click');
    
    // Slide in the notifications list.
    // NOTE: Setting opacity to 0 leads to jumpiness (perhaps setting display: none?).
    if ($('#notifications .notification').length > 0) {
      var fadeout_target = { height: '50px', opacity: 0.01 };
    } else {
      var fadeout_target = { opacity: 0.01 };
    }
    
    $('#notifications').animate(fadeout_target, 'slow', function() {
      // Once the list has slid into its minimal state, remove all contents
      // and fade in the loader.
      $(this).html('');
      $(this).addClass('loading');
      $('#templates .loading_spacer').clone().appendTo($(this));
      $(this).show();
      $(this).animate({ opacity: 1.0 }, 400);
    });
    
    BG.check(true, function() {
      console.log('Check successful. Refilling.');
      // Fade out the loader.
      $('#notifications').animate({ opacity: 0 }, 400, function() {
        var $this = $(this);
        // Fill the table - done at this point to get the final height.
        fillNotifications(function() {
          // Remember the height and content of the table.
          var height = $this.height();
          var html = $this.html();
          
          // Remove the loader, empty the table, and reset its height back to
          // 50px. The user does not see any change from the time the fade-out
          // finished.
          $this.removeClass('loading').html('').height(50);
          // Slide the table to our pre-calculated height.
          $this.animate({ height: height + 'px' }, 'slow', function() {
            // Put the table contents back and fade it in.
            $this.css({ height: 'auto' });
            $this.html(html);
            $this.animate({ opacity: 1 }, 400);
            $('#check_now').click(checkAllPages);
          });
        });
      });
    });
  });
}
